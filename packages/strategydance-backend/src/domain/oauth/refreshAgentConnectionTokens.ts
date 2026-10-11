import {
  getAgentConnectionRefreshToken,
  getAgentConnectionTokens,
  revokeAgentConnection,
  rotateAgentConnectionRefreshToken,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import deriveSuccessorTokens from '~domain/oauth/deriveSuccessorTokens'
import hashOAuthToken from '~domain/oauth/hashOAuthToken'
import parseModuleResource from '~domain/oauth/parseModuleResource'
import readOAuthTokenSecret from '~domain/oauth/readOAuthTokenSecret'
import toTokenAnswer, { type TokenResult } from '~domain/oauth/toTokenAnswer'

type Refresh = {
  refresh_token?: string
  client_id?: string
  resource?: string
}

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
  only from the client it was issued to, for the resource it was issued for
*/
async function refreshAgentConnectionTokens(values: Refresh, attempt = 1): Promise<TokenResult> {
  const { refresh_token: refreshToken, client_id: clientId, resource } = values

  if (!refreshToken || !clientId) return refuse('invalid_request', 'A refresh names its refresh_token and client_id')
  if (!resource) return refuse('invalid_request', 'A token request names its resource')

  const { data } = await getAgentConnectionRefreshToken(dataConnect, { hash: hashOAuthToken(refreshToken) })
  const [token] = data.token

  if (!token) return refuse('invalid_grant', 'The refresh token is unknown, expired or revoked')
  if (clientId !== token.connection.clientId)
    return refuse('invalid_grant', 'The refresh token was issued to another client')
  if (parseModuleResource(resource)?.resource !== token.resource) {
    return refuse('invalid_target', 'The refresh token was issued for another resource')
  }

  const scopes = token.connection.scopes

  if (!token.usedAt) {
    const secret = await readOAuthTokenSecret()
    const successors = deriveSuccessorTokens(refreshToken, secret.value)

    try {
      await rotateAgentConnectionRefreshToken(dataConnect, {
        id: token.id,
        connectionId: token.connection.id,
        resource: token.resource,
        successorKeyVersion: secret.version,
        accessTokenHash: hashOAuthToken(successors.accessToken),
        refreshTokenHash: hashOAuthToken(successors.refreshToken),
      })
    } catch (error) {
      // Another refresh spent it in between: read it again, as the duplicate it now is
      if (attempt < 2 && error instanceof Error && error.message.includes('The refresh token was used already')) {
        return refreshAgentConnectionTokens(values, attempt + 1)
      }

      throw error
    }

    return { outcome: 'tokens', tokens: toTokenAnswer({ ...successors, scopes }) }
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

  const secret = await readOAuthTokenSecret(token.successorKeyVersion)
  const successors = deriveSuccessorTokens(refreshToken, secret.value)
  const accessTokenHash = hashOAuthToken(successors.accessToken)
  const refreshTokenHash = hashOAuthToken(successors.refreshToken)
  const { data: stored } = await getAgentConnectionTokens(dataConnect, { hashes: [accessTokenHash, refreshTokenHash] })
  const access = stored.agentConnectionTokens.find(({ hash }) => hash === accessTokenHash)
  const refresh = stored.agentConnectionTokens.find(({ hash }) => hash === refreshTokenHash)

  // Both successors still there, on the same connection, or the duplicate hands out nothing
  if (
    !access
    || !refresh
    || access.connectionId !== token.connection.id
    || refresh.connectionId !== token.connection.id
  ) {
    return refuse('invalid_grant', 'The refresh token was used already')
  }

  const expiresInSeconds = Math.max(0, Math.floor((Date.parse(access.expiresAt) - Date.now()) / 1000))

  return { outcome: 'tokens', tokens: toTokenAnswer({ ...successors, scopes, expiresInSeconds }) }
}

export default refreshAgentConnectionTokens
