import { randomUUID } from 'node:crypto'

import {
  connectIntegration,
  consumeIntegrationAuthorization,
  getIntegrationAuthorizationForMember,
  getIntegrationConnectionForMember,
  IntegrationApiKeyScheme,
  IntegrationAuthentication,
  recordFirstIntegrationTools,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import createIntegrationFetch from '~domain/integrations/createIntegrationFetch'
import decryptIntegrationSecret from '~domain/integrations/decryptIntegrationSecret'
import encryptIntegrationSecret from '~domain/integrations/encryptIntegrationSecret'
import forgetRefusedIntegrationClient from '~domain/integrations/forgetRefusedIntegrationClient'
import IntegrationFailure from '~domain/integrations/IntegrationFailure'
import IntegrationTokenRefusal from '~domain/integrations/IntegrationTokenRefusal'
import isIntegrationClientAuthenticationMethod from '~domain/integrations/isIntegrationClientAuthenticationMethod'
import reachIntegration from '~domain/integrations/reachIntegration'
import readIntegrationForAdministrator from '~domain/integrations/readIntegrationForAdministrator'
import requestIntegrationTokens, { type IntegrationTokens } from '~domain/integrations/requestIntegrationTokens'
import revokeIntegrationTokens from '~domain/integrations/revokeIntegrationTokens'
import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'

type FinishIntegrationConnectionParameters = {
  organizationId: string
  userId: string
  integrationId: string
  authorizationId: string
}

/*
  Finishes a member's Connect, once its sign-in brought a code back to the callback, for the member
  signed in alone: a Connect another account started is refused and left as it is, so a sign-in
  somebody started and sent to them connects nothing.

  The Connect is consumed first, deleted under a check that it was there, with its code, before the
  code expired, so two finishes exchange it once. The server has to be the one it started on, at the
  same revision and issuer. The code is exchanged with the verifier its challenge was made from, and
  the tokens stored, encrypted under a fresh generation, replacing the member's earlier connection;
  tokens a refused write could not keep are revoked, and so are those of a write that failed otherwise
  unless reading back finds them stored, its answer lost. The first connection to a server lists its tools
  with the new token, at the address of the revision connected, which nothing waits on
*/
async function finishIntegrationConnection({
  organizationId,
  userId,
  integrationId,
  authorizationId,
}: FinishIntegrationConnectionParameters) {
  const caller = { organizationId, userId, integrationId }
  const {
    data: {
      integrationAuthorizations: [authorization],
    },
  } = await getIntegrationAuthorizationForMember(dataConnect, { organizationId, integrationId, authorizationId })

  if (!authorization) return { outcome: 'expired' } as const
  if (authorization.membershipUserId !== userId) return { outcome: 'notYours' } as const

  const authenticationMethod = authorization.oauthClientAuthenticationMethod
  const isCodeLive = authorization.codeExpiresAt !== null && Date.parse(authorization.codeExpiresAt ?? '') > Date.now()

  if (!authorization.encryptedCode || !isCodeLive) return { outcome: 'expired' } as const
  if (!isIntegrationClientAuthenticationMethod(authenticationMethod)) return { outcome: 'conflict' } as const

  const stored = await readIntegrationForAdministrator(organizationId, integrationId)
  const isSameServer =
    stored
    && !stored.deletedAt
    && stored.authentication === IntegrationAuthentication.OAUTH
    && stored.configRevision === authorization.configRevision
    && stored.issuer === authorization.issuer

  if (!stored || !isSameServer) return { outcome: 'conflict' } as const

  const owner = { organizationId, integrationId, authorizationId, userId }
  let code
  let codeVerifier
  let clientSecret = null

  try {
    code = await decryptIntegrationSecret(authorization.encryptedCode, { purpose: 'authorization-code', ...owner })
    codeVerifier = await decryptIntegrationSecret(authorization.encryptedCodeVerifier, {
      purpose: 'code-verifier',
      ...owner,
    })

    if (stored.oauthClientId === authorization.oauthClientId && stored.encryptedOAuthClientSecret) {
      clientSecret = await decryptIntegrationSecret(stored.encryptedOAuthClientSecret, {
        purpose: 'client-secret',
        organizationId,
        integrationId,
      })
    }
  } catch (error) {
    logger.error("Integrations: a Connect's secrets could not be decrypted", error)

    return { outcome: 'keyUnavailable' } as const
  }

  const consumed = await runIntegrationWrite(() =>
    consumeIntegrationAuthorization(dataConnect, { ...caller, authorizationId }),
  )

  if (consumed) return consumed

  const endpoint = {
    issuer: authorization.issuer,
    tokenEndpoint: authorization.tokenEndpoint,
    resource: authorization.resource,
    client: { clientId: authorization.oauthClientId, clientSecret, authenticationMethod },
  }
  let tokens: IntegrationTokens

  try {
    tokens = await requestIntegrationTokens(endpoint, { code, codeVerifier }, createIntegrationFetch())
  } catch (error) {
    if (error instanceof IntegrationTokenRefusal) {
      logger.info(`Integrations: a code was refused, ${error.message}`)

      if (error.reason === 'invalidClient') await forgetRefusedIntegrationClient(caller, endpoint.client.clientId)

      return { outcome: 'connectionRefused' } as const
    }

    if (error instanceof IntegrationFailure) return { outcome: 'failed', kind: error.kind } as const

    throw error
  }

  // Tokens no connection keeps are revoked, whatever kept them from being stored, so no grant outlives
  // the member's sight of it
  const revoke = () =>
    revokeIntegrationTokens({ ...endpoint, revocationEndpoint: authorization.revocationEndpoint }, tokens)
  const generation = randomUUID()
  let encryptedAccessToken
  let encryptedRefreshToken = null

  try {
    const tokenOwner = { organizationId, integrationId, generation, userId }

    encryptedAccessToken = await encryptIntegrationSecret(tokens.accessToken, {
      purpose: 'access-token',
      ...tokenOwner,
    })

    if (tokens.refreshToken) {
      encryptedRefreshToken = await encryptIntegrationSecret(tokens.refreshToken, {
        purpose: 'refresh-token',
        ...tokenOwner,
      })
    }
  } catch (error) {
    logger.error("Integrations: a member's tokens could not be encrypted", error)
    await revoke()

    return { outcome: 'keyUnavailable' } as const
  }

  let refusal

  try {
    refusal = await runIntegrationWrite(() =>
      connectIntegration(dataConnect, {
        ...caller,
        configRevision: authorization.configRevision,
        generation,
        accountLabel: tokens.accountLabel,
        oauthClientId: authorization.oauthClientId,
        oauthClientAuthenticationMethod: authenticationMethod,
        resource: authorization.resource,
        issuer: authorization.issuer,
        isIssuerParameterSupported: authorization.isIssuerParameterSupported,
        tokenEndpoint: authorization.tokenEndpoint,
        revocationEndpoint: authorization.revocationEndpoint ?? null,
        encryptedAccessToken,
        encryptedRefreshToken,
        accessTokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
      }),
    )
  } catch (error) {
    if (!(await isStored(caller, encryptedAccessToken))) {
      await revoke()

      throw error
    }
  }

  if (refusal) {
    await revoke()

    return refusal
  }

  if (stored.toolCount === null || stored.toolCount === undefined) {
    await listFirstTools(caller, { url: stored.url, configRevision: stored.configRevision }, tokens.accessToken)
  }

  return { outcome: 'connected' } as const
}

// Whether the member's connection holds the access token a finish wrote, read back after its write
// failed, as a write whose answer was lost does; a read that fails too finds nothing
async function isStored(
  caller: { organizationId: string; userId: string; integrationId: string },
  encryptedAccessToken: string,
) {
  try {
    const {
      data: {
        integrationConnections: [connection],
      },
    } = await getIntegrationConnectionForMember(dataConnect, caller)

    return connection?.encryptedAccessToken === encryptedAccessToken
  } catch {
    return false
  }
}

/*
  Lists an OAuth server's tools with the first member's token, and stores them while the server
  still has none at the revision connected. A failure is logged and left for an administrator's Retry,
  since the connection stands without them
*/
async function listFirstTools(
  caller: { organizationId: string; userId: string; integrationId: string },
  { url, configRevision }: { url: string; configRevision: number },
  accessToken: string,
) {
  try {
    const reach = await reachIntegration({
      url,
      authentication: IntegrationAuthentication.OAUTH,
      credential: { key: accessToken, scheme: IntegrationApiKeyScheme.BEARER, header: null },
    })

    await recordFirstIntegrationTools(dataConnect, {
      ...caller,
      configRevision,
      tools: reach.tools ?? '[]',
      toolCount: reach.toolCount ?? 0,
      toolDefinitionHashes: reach.toolDefinitionHashes,
    })
  } catch (error) {
    logger.info(
      `Integrations: the first connection's tools could not be listed, ${error instanceof Error ? error.message : 'unknown'}`,
    )
  }
}

export default finishIntegrationConnection
