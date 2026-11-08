import {
  type ModuleName,
  type OAuthAuthorizationRequestSummary,
  readAgentConnectionReach,
  toModuleScopesInOrder,
} from 'strategydance-core'
import { getAgentConnectionForConsent } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import isLoopbackRedirectUri from '~domain/oauth/isLoopbackRedirectUri'
import loadOAuthAuthorizationRequest from '~domain/oauth/loadOAuthAuthorizationRequest'
import readHeldScopes from '~domain/oauth/readHeldScopes'

type Reading =
  | { outcome: 'found'; summary: OAuthAuthorizationRequestSummary }
  | { outcome: 'unknown' }
  | { outcome: 'refused'; reason: string }

/*
  What the consent page shows of a request to the member reading it: the client, its name cleaned,
  marked unverified when it registered and with its document's domain otherwise, never its logo;
  the host the member will be sent back to, and whether it is only a loopback address, which any
  program on the member's computer could be listening on; the address, the access asked for, and
  what the member's connection for that client at that address holds and reaches already, which the
  page keeps and ticks to begin with. A module's own address names its module too, for a page loaded
  before the one address
*/
async function readOAuthAuthorizationRequest(requestId: string, userId: string): Promise<Reading> {
  const loaded = await loadOAuthAuthorizationRequest(requestId)

  if (loaded.outcome === 'unknown') return loaded
  if (loaded.outcome === 'refused') return { outcome: 'refused', reason: loaded.reason }

  const { request, client, address, modules } = loaded
  const { data } = await getAgentConnectionForConsent(dataConnect, {
    userId,
    clientId: request.clientId,
    module: address.name,
  })
  const [connection] = data.agentConnections
  const reached = connection ? readAgentConnectionReach(connection, data.userOrganizations) : []

  return {
    outcome: 'found',
    summary: {
      client: { name: client.name, isVerified: client.isVerified, domain: client.domain },
      redirectHost: new URL(request.redirectUri).host,
      isLoopbackRedirect: isLoopbackRedirectUri(request.redirectUri),
      address: address.name,
      module: address.name === modules[0]?.name ? (address.name as ModuleName) : null,
      scopes: toModuleScopesInOrder(request.scopes),
      heldScopes: connection ? readHeldScopes(modules, connection.scopes) : [],
      expiresAt: request.expiresAt,
      reachedOrganizationIds: reached.map(({ organizationId }) => organizationId),
    },
  }
}

export default readOAuthAuthorizationRequest
