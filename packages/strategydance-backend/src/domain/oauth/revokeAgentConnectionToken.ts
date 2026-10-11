import {
  AgentConnectionTokenKind,
  deleteAgentConnectionAccessToken,
  getAgentConnectionTokenForRevocation,
  revokeAgentConnection,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import hashOAuthToken from '~domain/oauth/hashOAuthToken'

type Revocation = {
  token?: string
  client_id?: string
}

type Revoked = { outcome: 'revoked' } | { outcome: 'error'; error: string; description: string }

/*
  Token revocation (RFC 7009): a client revokes a token it holds, naming itself, every client being
  public, and a token issued to another client is refused rather than revoked, so no client ends
  somebody else's connection. A refresh token ends the whole connection, every token it issued
  included; an access token, itself alone. A token the server does not know is answered as revoked,
  as the RFC asks, since there is nothing left to revoke
*/
async function revokeAgentConnectionToken({ token, client_id: clientId }: Revocation): Promise<Revoked> {
  if (!token || !clientId) {
    return { outcome: 'error', error: 'invalid_request', description: 'A revocation names its token and client_id' }
  }

  const { data } = await getAgentConnectionTokenForRevocation(dataConnect, { hash: hashOAuthToken(token) })
  const [stored] = data.agentConnectionTokens

  if (!stored) return { outcome: 'revoked' }
  if (stored.connection.clientId !== clientId) {
    return { outcome: 'error', error: 'unauthorized_client', description: 'The token was issued to another client' }
  }

  if (stored.kind === AgentConnectionTokenKind.REFRESH)
    await revokeAgentConnection(dataConnect, { id: stored.connection.id })
  else await deleteAgentConnectionAccessToken(dataConnect, { id: stored.id })

  return { outcome: 'revoked' }
}

export default revokeAgentConnectionToken
