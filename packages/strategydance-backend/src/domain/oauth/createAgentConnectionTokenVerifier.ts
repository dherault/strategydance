import { OAuthError, OAuthErrorCode, type OAuthTokenVerifier } from '@modelcontextprotocol/server'
import { MODULES_ADDRESS, readAgentConnectionReach, toOrganizationPathSegment } from 'strategydance-core'
import { getAgentConnectionAccessToken } from 'strategydance-database/backend'

import type { ModuleAccess } from '~types'

import { dataConnect } from '~firebase'

import createAgentConnectionUseRecorder from '~domain/oauth/createAgentConnectionUseRecorder'
import hashOAuthToken from '~domain/oauth/hashOAuthToken'
import parseModuleResource from '~domain/oauth/parseModuleResource'
import readHeldScopes from '~domain/oauth/readHeldScopes'
import toExternalIdempotencyScope from '~domain/oauth/toExternalIdempotencyScope'

import toModuleAuthInfo from '~modules/toModuleAuthInfo'

/*
  The verifier a module's public endpoint checks every call's bearer token with, for the SDK's
  `requireBearerAuth`: one read, by the token's hash, of an unexpired access token alone, never a
  refresh token, with its connection and the member's memberships. A token issued for another
  module's address is refused, so a token for one module never opens another. The connection acts
  in the organizations it reaches (`readAgentConnectionReach`), so one the member left, or left and
  rejoined, drops out at its next call, and a connection reaching none is refused. A token that
  passes marks its connection used, at most once a minute.

  It answers the SDK's `AuthInfo` carrying the access the module acts with, an external agent in
  each organization reached, with its membership, its slug and its name, the token's scopes and the
  connection's, its idempotency scope, and the token's expiry and resource, which the bearer check
  requires. The idempotency scope is `external:` and a hash of the member, the client and the
  address at the one address (`toExternalIdempotencyScope`), and `connection:<id>` at a module's own
*/
function createAgentConnectionTokenVerifier(resource: URL): OAuthTokenVerifier {
  const target = parseModuleResource(resource.href)
  const expectedResource = target?.resource
  const modules = target?.modules ?? []
  // The one address keys a connection's writes on what outlives a consent, and a module's own
  // address on its connection, as before the one address, so no write in flight across the release
  // that served it changes scope
  const isOneAddress = target?.address.name === MODULES_ADDRESS.name
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
      const reached = readAgentConnectionReach(connection, connection.user.userOrganizations_on_user)

      if (!reached.length) {
        throw new OAuthError(
          OAuthErrorCode.InvalidToken,
          "The connection reaches none of the member's organizations any more",
        )
      }

      const access: ModuleAccess = {
        kind: 'external',
        userId: connection.userId,
        // What the token holds, which a refresh may have narrowed, within its connection's, and what
        // the connection holds, which a challenge names, both of the modules the address serves
        scopes: readHeldScopes(
          modules,
          stored.scopes.filter(scope => connection.scopes.includes(scope)),
        ),
        connectionScopes: readHeldScopes(modules, connection.scopes),
        idempotencyScope: isOneAddress
          ? toExternalIdempotencyScope(connection.userId, connection.clientId, MODULES_ADDRESS.name)
          : `connection:${connection.id}`,
        organizations: reached.map(({ organizationId, createdAt, organization }) => ({
          organizationId,
          membershipCreatedAt: createdAt,
          segment: toOrganizationPathSegment({ id: organizationId, slug: organization.slug }),
          name: organization.name,
        })),
      }

      await recordUse(connection.id, connection.userId)

      return toModuleAuthInfo(access, {
        token,
        clientId: connection.clientId,
        expiresAt: Math.floor(Date.parse(stored.expiresAt) / 1000),
        resource: new URL(stored.resource),
      })
    },
  }
}

export default createAgentConnectionTokenVerifier
