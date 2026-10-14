import { randomUUID } from 'node:crypto'

import {
  claimIntegrationConnectionRefresh,
  getIntegrationConnectionForMember,
  IntegrationAuthentication,
  IntegrationConnectionStatus,
  IntegrationError,
  markIntegrationConnectionNeedsAuthentication,
  markIntegrationConnectionTokenRefused,
  recordIntegrationConnectionTokens,
  releaseIntegrationConnectionRefresh,
} from 'strategydance-database/backend'

import { INTEGRATION_REFRESH_MARGIN_MS, INTEGRATION_REFRESH_POLL_MS, INTEGRATION_REFRESH_WAIT_MS } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import createIntegrationFetch from '~domain/integrations/createIntegrationFetch'
import decryptIntegrationSecret from '~domain/integrations/decryptIntegrationSecret'
import encryptIntegrationSecret from '~domain/integrations/encryptIntegrationSecret'
import forgetRefusedIntegrationClient from '~domain/integrations/forgetRefusedIntegrationClient'
import IntegrationFailure from '~domain/integrations/IntegrationFailure'
import IntegrationTokenRefusal from '~domain/integrations/IntegrationTokenRefusal'
import isIntegrationClientAuthenticationMethod from '~domain/integrations/isIntegrationClientAuthenticationMethod'
import readIntegrationRefusal from '~domain/integrations/readIntegrationRefusal'
import requestIntegrationTokens from '~domain/integrations/requestIntegrationTokens'
import revokeIntegrationTokens from '~domain/integrations/revokeIntegrationTokens'

type IntegrationCaller = {
  organizationId: string
  userId: string
  integrationId: string
}

type ReadIntegrationAccessTokenOptions = {
  // The ciphertext of the access token a server just refused with a 401, which a refresh replaces
  // whatever its expiry says, once
  refusedAccessToken?: string
  // Aborted once the caller stops waiting, as a call does past its 30 seconds: a caller waiting for
  // another's refresh then stops, as busy
  signal?: AbortSignal
}

/*
  A member's access token to a server, what it goes to and what it was read as: ready, or why not.
  `encryptedAccessToken` is what a caller hands back as `refusedAccessToken` when the server refuses
  the token, so the refresh that follows replaces that very token, and, with `generation`, what marks
  the connection when even a refreshed token is refused (`MarkIntegrationConnectionTokenRefused`).
  `configRevision` and `isEnabled` are the server's as the token was read with it, which a call an
  approval was bound to checks
*/
type IntegrationAccess =
  | {
      outcome: 'ready'
      url: string
      accessToken: string
      encryptedAccessToken: string
      generation: string
      configRevision: number
      isEnabled: boolean
    }
  | { outcome: 'notConnected' | 'needsAuthentication' | 'busy' | 'keyUnavailable' }
  | { outcome: 'failed'; kind: IntegrationError }

type StoredConnection = NonNullable<Awaited<ReturnType<typeof readConnection>>>

/*
  A member's access token to one of the organization's OAuth servers, and the address it goes to, read
  in one read, so a token goes only to the server at the revision it was given for (M29's calls go
  through here).

  A token that expires within a minute, or that the server just refused, is refreshed first, by one
  caller at a time: a refresh claims a lease on the connection, from the database's clock, only while
  the connection holds the refresh token this caller read, so a caller whose read another refresh has
  overtaken claims nothing, and only while no lease is held, or the one held has lapsed, as a crashed
  refresh's has. A caller who claims nothing reads the connection again every half second, for twenty
  seconds at most, and takes the refreshed token, or claims a lapsed lease, so a rotating refresh
  token is never spent twice.

  A refresh the authorization server refuses for good marks the connection as needing the member,
  under its lease and while it still holds the access token it read, so tokens written meanwhile are
  never dropped. A client the server no longer takes is forgotten for the next Connect to register
  again. Any other failure lets the lease go for the next caller. A refresh whose lease was taken over
  writes nothing, revokes the tokens it got, and reads again; one whose write fails otherwise reads
  back whether it landed, and revokes the tokens it got when it did not
*/
async function readIntegrationAccessToken(
  caller: IntegrationCaller,
  { refusedAccessToken, signal }: ReadIntegrationAccessTokenOptions = {},
): Promise<IntegrationAccess> {
  const deadline = Date.now() + INTEGRATION_REFRESH_WAIT_MS

  for (;;) {
    const connection = await readConnection(caller)

    if (!connection) return { outcome: 'notConnected' }
    if (connection.status !== IntegrationConnectionStatus.CONNECTED || !connection.encryptedAccessToken) {
      return { outcome: 'needsAuthentication' }
    }

    const isRefused = connection.encryptedAccessToken === refusedAccessToken
    const isExpiring =
      connection.accessTokenExpiresAt !== null
      && connection.accessTokenExpiresAt !== undefined
      && Date.parse(connection.accessTokenExpiresAt) - Date.now() < INTEGRATION_REFRESH_MARGIN_MS

    if (!isRefused && !isExpiring) return open(caller, connection, connection.encryptedAccessToken)

    if (!connection.encryptedRefreshToken) {
      // An expiring token with nothing to refresh it is still tried: the server is what refuses it
      if (!isRefused) return open(caller, connection, connection.encryptedAccessToken)

      await markIntegrationConnectionTokenRefused(dataConnect, {
        ...caller,
        generation: connection.generation,
        encryptedAccessToken: connection.encryptedAccessToken,
      })

      return { outcome: 'needsAuthentication' }
    }

    const refreshLeaseId = randomUUID()
    const { data } = await claimIntegrationConnectionRefresh(dataConnect, {
      ...caller,
      generation: connection.generation,
      encryptedRefreshToken: connection.encryptedRefreshToken,
      refreshLeaseId,
    })

    if (data.integrationConnection_updateMany === 1) {
      const refreshed = await refresh(caller, connection, refreshLeaseId, {
        encryptedAccessToken: connection.encryptedAccessToken,
        encryptedRefreshToken: connection.encryptedRefreshToken,
      })

      if (refreshed !== 'leaseLost') return refreshed
    } else if (Date.now() >= deadline || signal?.aborted) {
      return { outcome: 'busy' }
    } else {
      await new Promise(resolve => setTimeout(resolve, INTEGRATION_REFRESH_POLL_MS))
    }
  }
}

// The member's connection with the server it is used against, or null when they have none, or none
// for the server as it is now
async function readConnection(caller: IntegrationCaller) {
  const {
    data: {
      integrationConnections: [connection],
    },
  } = await getIntegrationConnectionForMember(dataConnect, caller)

  if (!connection) return null

  const { integration } = connection
  const isCurrent =
    !integration.deletedAt
    && integration.authentication === IntegrationAuthentication.OAUTH
    && integration.configRevision === connection.configRevision

  return isCurrent ? connection : null
}

async function open(
  caller: IntegrationCaller,
  connection: StoredConnection,
  encryptedAccessToken: string,
): Promise<IntegrationAccess> {
  try {
    return {
      outcome: 'ready',
      url: connection.integration.url,
      accessToken: await decryptIntegrationSecret(
        encryptedAccessToken,
        toTokenOwner(caller, connection, 'access-token'),
      ),
      encryptedAccessToken,
      generation: connection.generation,
      configRevision: connection.integration.configRevision,
      isEnabled: connection.integration.isEnabled,
    }
  } catch (error) {
    logger.error("Integrations: a member's access token could not be decrypted", error)

    return { outcome: 'keyUnavailable' }
  }
}

// Refreshes the member's tokens under the lease it claimed, or says the lease was lost to read again
async function refresh(
  caller: IntegrationCaller,
  connection: StoredConnection,
  refreshLeaseId: string,
  read: { encryptedAccessToken: string; encryptedRefreshToken: string },
): Promise<IntegrationAccess | 'leaseLost'> {
  const lease = { ...caller, refreshLeaseId }
  const release = () => releaseIntegrationConnectionRefresh(dataConnect, lease)
  const authenticationMethod = connection.oauthClientAuthenticationMethod
  const { integration } = connection

  if (!isIntegrationClientAuthenticationMethod(authenticationMethod)) {
    await release()

    return { outcome: 'needsAuthentication' }
  }

  let refreshToken
  let clientSecret = null

  try {
    refreshToken = await decryptIntegrationSecret(
      read.encryptedRefreshToken,
      toTokenOwner(caller, connection, 'refresh-token'),
    )

    if (integration.oauthClientId === connection.oauthClientId && integration.encryptedOAuthClientSecret) {
      clientSecret = await decryptIntegrationSecret(integration.encryptedOAuthClientSecret, {
        purpose: 'client-secret',
        organizationId: caller.organizationId,
        integrationId: caller.integrationId,
      })
    }
  } catch (error) {
    logger.error("Integrations: a member's refresh token could not be decrypted", error)
    await release()

    return { outcome: 'keyUnavailable' }
  }

  const endpoint = {
    issuer: connection.issuer,
    tokenEndpoint: connection.tokenEndpoint,
    resource: connection.resource,
    client: { clientId: connection.oauthClientId, clientSecret, authenticationMethod },
  }
  let tokens

  try {
    tokens = await requestIntegrationTokens(endpoint, { refreshToken }, createIntegrationFetch())
  } catch (error) {
    const isForGood = error instanceof IntegrationTokenRefusal && error.reason !== 'refused'

    if (isForGood) {
      logger.info(`Integrations: a refresh was refused, ${error.message}`)

      if (error.reason === 'invalidClient') await forgetRefusedIntegrationClient(caller, connection.oauthClientId)

      await markIntegrationConnectionNeedsAuthentication(dataConnect, {
        ...lease,
        generation: connection.generation,
        encryptedAccessToken: read.encryptedAccessToken,
      })

      return { outcome: 'needsAuthentication' }
    }

    await release()

    if (error instanceof IntegrationFailure) return { outcome: 'failed', kind: error.kind }
    if (error instanceof IntegrationTokenRefusal) return { outcome: 'failed', kind: IntegrationError.UNREACHABLE }

    throw error
  }

  let encryptedAccessToken
  // A server that does not rotate its refresh tokens answers none, and the one held stays good
  let encryptedRefreshToken = read.encryptedRefreshToken
  // Whether the server answered a refresh token of its own, which spent the one sent
  const isRotated = tokens.refreshToken !== null && tokens.refreshToken !== refreshToken
  /*
    The tokens the refresh got and could not keep, revoked, best effort, and never left as a grant
    nothing holds: the new access token, and the refresh token only where it is the server's new one,
    which no other refresh can hold, since it was never stored. One a server did not rotate is the
    stored one, still good, and stays
  */
  const revokeUnkept = () =>
    revokeIntegrationTokens(
      { revocationEndpoint: connection.revocationEndpoint, client: endpoint.client },
      { accessToken: tokens.accessToken, refreshToken: isRotated ? tokens.refreshToken : null },
    )

  try {
    encryptedAccessToken = await encryptIntegrationSecret(
      tokens.accessToken,
      toTokenOwner(caller, connection, 'access-token'),
    )

    if (tokens.refreshToken) {
      encryptedRefreshToken = await encryptIntegrationSecret(
        tokens.refreshToken,
        toTokenOwner(caller, connection, 'refresh-token'),
      )
    }
  } catch (error) {
    logger.error("Integrations: a member's refreshed tokens could not be encrypted", error)

    /*
      The tokens the refresh got cannot be kept. A server that rotated the refresh token spent the
      one stored, so the connection needs the member again; one that did not keeps it good, the lease
      let go for the next try
    */
    await revokeUnkept()

    if (!isRotated) {
      await release()

      return { outcome: 'keyUnavailable' }
    }

    await markIntegrationConnectionNeedsAuthentication(dataConnect, {
      ...lease,
      generation: connection.generation,
      encryptedAccessToken: read.encryptedAccessToken,
    })

    return { outcome: 'needsAuthentication' }
  }

  const ready: IntegrationAccess = {
    outcome: 'ready',
    url: integration.url,
    accessToken: tokens.accessToken,
    encryptedAccessToken,
    generation: connection.generation,
    configRevision: integration.configRevision,
    isEnabled: integration.isEnabled,
  }

  try {
    await recordIntegrationConnectionTokens(dataConnect, {
      ...lease,
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
    })
  } catch (error) {
    if (readIntegrationRefusal(error) === 'leaseLost') {
      // Another refresh took the lease over once it lapsed, and whatever it stored stands: the tokens
      // this one got are nobody's, and the caller reads the connection again
      await revokeUnkept()

      return 'leaseLost'
    }

    // A write that failed otherwise may have landed before its answer was lost: tokens it stored are
    // the connection's, and any it did not are revoked, as a read that fails too takes them to be
    if (await isStored(caller, encryptedAccessToken)) return ready

    await revokeUnkept()
    await release().catch(() => {})

    throw error
  }

  return ready
}

// Whether the member's connection holds the access token a refresh wrote, read back after its write failed
async function isStored(caller: IntegrationCaller, encryptedAccessToken: string) {
  try {
    return (await readConnection(caller))?.encryptedAccessToken === encryptedAccessToken
  } catch {
    return false
  }
}

// Whose a token is: the member's, at the server, under the connection's generation
function toTokenOwner(
  caller: IntegrationCaller,
  connection: StoredConnection,
  purpose: 'access-token' | 'refresh-token',
) {
  return {
    purpose,
    organizationId: caller.organizationId,
    integrationId: caller.integrationId,
    generation: connection.generation,
    userId: caller.userId,
  }
}

export { type IntegrationAccess }

export default readIntegrationAccessToken
