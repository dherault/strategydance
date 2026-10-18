import { OAuthError, OAuthErrorCode, type OAuthTokenVerifier } from '@modelcontextprotocol/server'
import type { ModuleScope } from 'strategydance-core'
import { getAgentConnectionAccessToken } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import createAgentConnectionUseRecorder from '~domain/oauth/createAgentConnectionUseRecorder'
import hashOAuthToken from '~domain/oauth/hashOAuthToken'
import parseModuleResource from '~domain/oauth/parseModuleResource'

import toModuleAuthInfo from '~modules/toModuleAuthInfo'

/*
  The verifier a module's public endpoint checks every call's bearer token with, for the SDK's
  `requireBearerAuth`: one read, by the token's hash, of an unexpired access token alone, never a
  refresh token, with its connection and the membership it belongs to. A token issued for another
  module's address is refused, so a token for one module never opens another. A member removed takes
  their connections with them, so their tokens are found no more. A token that passes marks its connection
  used, at most once a minute.

  It answers the SDK's `AuthInfo` carrying the caller the module acts as, an external agent on the
  member's membership, with the connection's scopes and its own idempotency scope, and the token's
  expiry and resource, which the bearer check requires
*/
function createAgentConnectionTokenVerifier(resource: URL): OAuthTokenVerifier {
  const expectedResource = parseModuleResource(resource.href)?.resource
  const recordUse = createAgentConnectionUseRecorder()

  return {
    async verifyAccessToken(token) {
      const { data } = await getAgentConnectionAccessToken(dataConnect, { hash: hashOAuthToken(token) })
      const [stored] = data.agentConnectionTokens

      if (!stored) throw new OAuthError(OAuthErrorCode.InvalidToken, 'The access token is unknown, expired or revoked')
      if (!expectedResource || stored.resource !== expectedResource) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, 'The access token was issued for another resource')
      }

      const { connection } = stored
      const { membership } = connection

      const caller: ModuleCaller = {
        kind: 'external',
        userId: membership.userId,
        organizationId: membership.organizationId,
        membershipCreatedAt: membership.createdAt,
        // What the token holds, which a refresh may have narrowed, within its connection's
        scopes: stored.scopes.filter(scope => connection.scopes.includes(scope)) as ModuleScope[],
        idempotencyScope: `connection:${connection.id}`,
      }

      await recordUse(connection.id, membership.userId)

      return toModuleAuthInfo(caller, {
        token,
        clientId: connection.clientId,
        expiresAt: Math.floor(Date.parse(stored.expiresAt) / 1000),
        resource: new URL(stored.resource),
      })
    },
  }
}

export default createAgentConnectionTokenVerifier
