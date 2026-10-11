import { OAuthError, OAuthErrorCode, type OAuthTokenVerifier } from '@modelcontextprotocol/server'
import type { ModuleScope } from 'strategydance-core'
import { getAgentConnectionAccessToken } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { IS_MODULES_RELEASE_GATED } from '~constants'

import { dataConnect } from '~firebase'

import hashOAuthToken from '~domain/oauth/hashOAuthToken'
import parseModuleResource from '~domain/oauth/parseModuleResource'

import toModuleAuthInfo from '~modules/toModuleAuthInfo'

/*
  The verifier a module's public endpoint checks every call's bearer token with, for the SDK's
  `requireBearerAuth`: one read, by the token's hash, of an unexpired access token alone, never a
  refresh token, with its connection, the membership it belongs to and the account's staff role,
  while modules are for Strategy Dance's administrators alone. A token issued for another module's
  address is refused, so a token for one module never opens another, and so is one whose account
  is no longer staff, so a connection outlives no lost role. A member removed takes their
  connections with them, so their tokens are found no more.

  It answers the SDK's `AuthInfo` carrying the caller the module acts as, an external agent on the
  member's membership, with the connection's scopes and its own idempotency scope, and the token's
  expiry and resource, which the bearer check requires
*/
function createAgentConnectionTokenVerifier(resource: URL): OAuthTokenVerifier {
  const expectedResource = parseModuleResource(resource.href)?.resource

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

      if (IS_MODULES_RELEASE_GATED && !membership.user.isAdministrator) {
        throw new OAuthError(
          OAuthErrorCode.InvalidToken,
          'Connecting agents is open to Strategy Dance’s administrators alone',
        )
      }

      const caller: ModuleCaller = {
        kind: 'external',
        userId: membership.userId,
        organizationId: membership.organizationId,
        membershipCreatedAt: membership.createdAt,
        scopes: connection.scopes as ModuleScope[],
        idempotencyScope: `connection:${connection.id}`,
      }

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
