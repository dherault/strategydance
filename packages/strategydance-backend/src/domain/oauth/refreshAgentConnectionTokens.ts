import { type ModuleDefinition, readAgentConnectionReach } from 'strategydance-core'
import {
  getAgentConnectionRefreshToken,
  getAgentConnectionTokens,
  revokeAgentConnection,
  rotateAgentConnectionRefreshToken,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import checkModuleScopes from '~domain/oauth/checkModuleScopes'
import deriveSuccessorTokens from '~domain/oauth/deriveSuccessorTokens'
import describeModuleScopes from '~domain/oauth/describeModuleScopes'
import hashOAuthToken from '~domain/oauth/hashOAuthToken'
import isConnectionGoneRefusal from '~domain/oauth/isConnectionGoneRefusal'
import parseModuleResource from '~domain/oauth/parseModuleResource'
import readHeldScopes from '~domain/oauth/readHeldScopes'
import readOAuthTokenSecret from '~domain/oauth/readOAuthTokenSecret'
import toTokenAnswer, { type TokenResult } from '~domain/oauth/toTokenAnswer'

type Refresh = {
  refresh_token?: string
  client_id?: string
  resource?: string
  scope?: string
}

/*
  How many rotations a duplicate follows to the pair its client holds now. Each was made within the
  30 seconds since the token presented was spent, and the token endpoint takes a request a second
  from an address on average, so a client that rotated more than this many times in those seconds
  is answered `invalid_grant`, its connection left alone
*/
const MAX_DUPLICATE_CHAIN = 30

function refuse(error: string, description: string): TokenResult {
  return { outcome: 'error', error, description }
}

/*
  The refresh token grant, which rotates: the token is spent, once, and its successors, derived from
  it under the server's secret, are stored. Presented again within 30 seconds, as by a client whose
  answer was lost or two refreshes at once, it is answered with the very same pair, derived again
  under the secret's version its first use recorded, so whichever answer arrives last, the client
  holds tokens that work. Presented after that, it revokes the connection: whoever holds it replays
  a token somebody else already used. Only a refresh token is taken here, never an access token, and
  only from the client it was issued to, for the resource it was issued for, and only while its
  connection reaches one of the member's organizations.

  A refresh may name fewer scopes than its token was granted, never others (RFC 6749, 6): the access
  token it issues holds those alone, and the refresh token keeps the ones it had, so a later refresh
  naming none gets them all back. Both keep within what the connection holds now, which the member
  may have narrowed since on Connected agents, so a client is never told of access taken away. A
  refresh still naming it, as a client repeating the scope it first asked for does, gets what is
  left, which its answer names (RFC 6749, 5.1), rather than a refusal that would send the member
  through a consent again
*/
async function refreshAgentConnectionTokens(values: Refresh, attempt = 1): Promise<TokenResult> {
  const { refresh_token: refreshToken, client_id: clientId, resource, scope } = values

  if (!refreshToken || !clientId) return refuse('invalid_request', 'A refresh names its refresh_token and client_id')
  if (!resource) return refuse('invalid_request', 'A token request names its resource')

  const { data } = await getAgentConnectionRefreshToken(dataConnect, { hash: hashOAuthToken(refreshToken) })
  const [token] = data.token

  if (!token) return refuse('invalid_grant', 'The refresh token is unknown, expired or revoked')
  if (clientId !== token.connection.clientId) {
    return refuse('invalid_grant', 'The refresh token was issued to another client')
  }

  const target = parseModuleResource(resource)

  if (!target || target.resource !== token.resource) {
    return refuse('invalid_target', 'The refresh token was issued for another resource')
  }

  // A connection reaching none of the member's organizations any more opens nothing, so nothing is
  // issued for it: its client asks the member again rather than refresh what the verifier refuses
  if (!readAgentConnectionReach(token.connection, token.connection.user.userOrganizations_on_user).length) {
    return refuse('invalid_grant', "The connection reaches none of the member's organizations any more")
  }

  // What the refresh names: the refresh token's scopes or fewer, under the rule a consent holds to,
  // at least one module's read and never a write without its read. The refresh token's are those of
  // a module its address still serves, so a module the address stops serving drops out rather than
  // refuse every refresh
  const tokenScopes = readHeldScopes(target.modules, token.scopes)
  const granted = new Set<string>(tokenScopes)
  const asked = scope ? new Set(scope.split(' ').filter(Boolean)) : granted

  if ([...asked].some(named => !granted.has(named)) || !checkModuleScopes(target.modules, [...asked])) {
    return refuse(
      'invalid_scope',
      `A refresh asks for ${describeModuleScopes(target.modules)}, within the scopes its token was granted`,
    )
  }

  // What the pair holds: those within what the connection still holds, so a narrowing on Connected
  // agents carries on into it, in `MODULES`' order. A narrowing that commits between this read and
  // the rotation shows from the next call, since the verifier narrows an access token to its
  // connection's at every call
  const connectionScopes = readHeldScopes(target.modules, token.connection.scopes)
  const refreshScopes = tokenScopes.filter(held => connectionScopes.includes(held))
  const accessScopes = refreshScopes.filter(held => asked.has(held))

  if (!checkModuleScopes(target.modules, accessScopes)) {
    return refuse('invalid_scope', 'The member has since taken away every module this refresh asks for')
  }

  if (!token.usedAt) {
    const secret = await readOAuthTokenSecret()
    const successors = deriveSuccessorTokens(refreshToken, secret.value)

    try {
      await rotateAgentConnectionRefreshToken(dataConnect, {
        id: token.id,
        connectionId: token.connection.id,
        resource: token.resource,
        accessScopes,
        refreshScopes,
        successorKeyVersion: secret.version,
        accessTokenHash: hashOAuthToken(successors.accessToken),
        refreshTokenHash: hashOAuthToken(successors.refreshToken),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      // The connection went meanwhile, replaced, revoked or its member removed, and the token with it
      if (isConnectionGoneRefusal(message)) return refuse('invalid_grant', 'The refresh token was revoked')

      // Another refresh spent it in between: read it again, as the duplicate it now is
      if (attempt < 2 && message.includes('The refresh token was used already')) {
        return refreshAgentConnectionTokens(values, attempt + 1)
      }

      throw error
    }

    return { outcome: 'tokens', tokens: toTokenAnswer({ ...successors, scopes: accessScopes }) }
  }

  if (
    data.recentlySpent.length === 0
    || token.successorKeyVersion === null
    || token.successorKeyVersion === undefined
  ) {
    await revokeAgentConnection(dataConnect, { id: token.connection.id })
    logger.warn(`OAuth: a spent refresh token was presented again, so its connection ${token.connection.id} is revoked`)

    return refuse('invalid_grant', 'The refresh token was used already, and what it issued is revoked')
  }

  return answerDuplicate(refreshToken, token.successorKeyVersion, {
    connectionId: token.connection.id,
    modules: target.modules,
    connectionScopes,
    accessScopes,
  })
}

type Duplicate = {
  connectionId: string
  // The address's modules, under whose rule what the pair still grants is read
  modules: readonly ModuleDefinition[]
  // What the connection holds now, which the pair's access token grants no more than
  connectionScopes: readonly string[]
  // What this refresh asks for, within the refresh token's and the connection's
  accessScopes: readonly string[]
}

/*
  A duplicate's answer: the pair the spent token was rotated into, derived again under the version
  its rotation recorded, while both are still stored on its connection, or nothing, so it never
  hands out a token revoked since. When the client has rotated that refresh token in turn, as one
  that refreshed again before a delayed duplicate arrived has, the chain is followed to the pair it
  holds now, a few links at most, since each was rotated within the 30 seconds before.

  What the pair grants is its access token's scopes within the connection's, since the verifier
  narrows it so at every call: a rotation from before a narrowing on Connected agents is answered
  naming what is left, rather than a write taken away since, or refused for it. A pair granting
  more than this refresh asks for is refused, since the duplicate would then hand out access it did
  not ask for, and so is one a narrowing left reading no module, which would open nothing
*/
async function answerDuplicate(
  spentToken: string,
  version: number,
  { connectionId, modules, connectionScopes, accessScopes }: Duplicate,
): Promise<TokenResult> {
  let spent = spentToken
  let successorKeyVersion = version

  for (let link = 0; link < MAX_DUPLICATE_CHAIN; link++) {
    const secret = await readOAuthTokenSecret(successorKeyVersion)
    const successors = deriveSuccessorTokens(spent, secret.value)
    const accessTokenHash = hashOAuthToken(successors.accessToken)
    const refreshTokenHash = hashOAuthToken(successors.refreshToken)
    const { data } = await getAgentConnectionTokens(dataConnect, { hashes: [accessTokenHash, refreshTokenHash] })
    const access = data.agentConnectionTokens.find(({ hash }) => hash === accessTokenHash)
    const refresh = data.agentConnectionTokens.find(({ hash }) => hash === refreshTokenHash)

    // Both successors still there, on the same connection, or the duplicate hands out nothing
    if (!access || !refresh || access.connectionId !== connectionId || refresh.connectionId !== connectionId) break

    if (!refresh.usedAt) {
      const granted = access.scopes.filter(scope => connectionScopes.includes(scope))

      if (granted.some(scope => !accessScopes.includes(scope))) {
        return refuse('invalid_grant', 'The refresh token was used already, for more access than this refresh asks for')
      }

      if (!checkModuleScopes(modules, granted)) {
        return refuse('invalid_grant', 'The refresh token was used already, for access its connection no longer holds')
      }

      const expiresInSeconds = Math.max(0, Math.floor((Date.parse(access.expiresAt) - Date.now()) / 1000))

      // The scopes its rotation issued that the connection still holds, which this refresh asked
      // for, or fewer
      return { outcome: 'tokens', tokens: toTokenAnswer({ ...successors, scopes: granted, expiresInSeconds }) }
    }

    if (refresh.successorKeyVersion === null || refresh.successorKeyVersion === undefined) break

    spent = successors.refreshToken
    successorKeyVersion = refresh.successorKeyVersion
  }

  return refuse('invalid_grant', 'The refresh token was used already, and rotated too many times since to follow')
}

export default refreshAgentConnectionTokens
