import {
  exchangeOAuthAuthorizationCode as exchangeCode,
  getOAuthAuthorizationRequestByCode,
  revokeAgentConnection,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import createOpaqueToken from '~domain/oauth/createOpaqueToken'
import hashOAuthToken from '~domain/oauth/hashOAuthToken'
import isConnectionGoneRefusal from '~domain/oauth/isConnectionGoneRefusal'
import parseModuleResource from '~domain/oauth/parseModuleResource'
import toTokenAnswer, { type TokenResult } from '~domain/oauth/toTokenAnswer'
import verifyPkce from '~domain/oauth/verifyPkce'

type CodeExchange = {
  code?: string
  redirect_uri?: string
  client_id?: string
  code_verifier?: string
  resource?: string
}

function refuse(error: string, description: string): TokenResult {
  return { outcome: 'error', error, description }
}

// A code presented again: whoever holds it replays what somebody else already used, so the whole
// connection goes, every token it issued included, which may have rotated already (RFC 6749, 4.1.2)
async function revokeForReuse(connectionId: string | null | undefined) {
  if (connectionId) {
    await revokeAgentConnection(dataConnect, { id: connectionId })
    logger.warn(`OAuth: a code was presented again, so its connection ${connectionId} is revoked`)
  }

  return refuse('invalid_grant', 'The code was used already, and what it issued is revoked')
}

/*
  The authorization code grant: a code exchanged once, within its minute, for an access token and
  a refresh token bound to the code's resource, by the client it was issued to, at the exact
  redirect address its authorization named, proving with its PKCE verifier that it is whoever asked
  for the code. A code used already revokes its connection, whoever presents it
*/
async function exchangeOAuthAuthorizationCode(values: CodeExchange): Promise<TokenResult> {
  const { code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier, resource } = values

  if (!code || !clientId || !redirectUri || !verifier) {
    return refuse('invalid_request', 'A code exchange names its code, client_id, redirect_uri and code_verifier')
  }
  if (!resource) return refuse('invalid_request', 'A token request names its resource')

  const codeHash = hashOAuthToken(code)
  const { data } = await getOAuthAuthorizationRequestByCode(dataConnect, { codeHash })
  const [request] = data.oAuthAuthorizationRequests

  if (!request) return refuse('invalid_grant', 'The code is unknown')
  if (request.codeUsedAt) return revokeForReuse(request.connection?.id)
  if (clientId !== request.clientId) return refuse('invalid_grant', 'The code was issued to another client')
  if (redirectUri !== request.redirectUri)
    return refuse('invalid_grant', 'The code was issued for another redirect_uri')
  if (parseModuleResource(resource)?.resource !== request.resource) {
    return refuse('invalid_target', 'The code was issued for another resource')
  }
  if (!verifyPkce(verifier, request.codeChallenge)) return refuse('invalid_grant', 'The code_verifier does not match')
  if (!request.connection) return refuse('invalid_grant', 'The connection the code opened was replaced or revoked')

  const accessToken = createOpaqueToken()
  const refreshToken = createOpaqueToken()

  try {
    await exchangeCode(dataConnect, {
      id: request.id,
      codeHash,
      connectionId: request.connection.id,
      resource: request.resource,
      scopes: request.connection.scopes,
      accessTokenHash: hashOAuthToken(accessToken),
      refreshTokenHash: hashOAuthToken(refreshToken),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (!message.includes('The code was used already or has expired') && !isConnectionGoneRefusal(message)) throw error

    // Another exchange of the same code may have landed in between, which is a reuse too, or the
    // connection gone, replaced or revoked
    const { data: again } = await getOAuthAuthorizationRequestByCode(dataConnect, { codeHash })
    const [current] = again.oAuthAuthorizationRequests

    if (current?.codeUsedAt) return revokeForReuse(current.connection?.id ?? request.connection.id)
    if (!current?.connection) return refuse('invalid_grant', 'The connection the code opened was replaced or revoked')

    return refuse('invalid_grant', 'The code has expired')
  }

  return { outcome: 'tokens', tokens: toTokenAnswer({ accessToken, refreshToken, scopes: request.connection.scopes }) }
}

export default exchangeOAuthAuthorizationCode
