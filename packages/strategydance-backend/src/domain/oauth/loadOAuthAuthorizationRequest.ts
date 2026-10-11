import type { ModuleDefinition } from 'strategydance-core'
import { getPendingOAuthAuthorizationRequest } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import matchesRedirectUri from '~domain/oauth/matchesRedirectUri'
import parseModuleResource from '~domain/oauth/parseModuleResource'
import resolveOAuthClient, { type OAuthClient } from '~domain/oauth/resolveOAuthClient'

export type PendingOAuthAuthorizationRequest = {
  id: string
  clientId: string
  redirectUri: string
  resource: string
  scopes: string[]
  state: string | null
  expiresAt: string
}

type LoadedRequest =
  | { outcome: 'found'; request: PendingOAuthAuthorizationRequest; client: OAuthClient; module: ModuleDefinition }
  | { outcome: 'unknown' }
  | { outcome: 'refused'; request: PendingOAuthAuthorizationRequest; reason: string }

/*
  An authorization request the member can still decide, with its client known good: a registered
  client read from its registration, or a client ID metadata document fetched, which happens here
  for the first time, once a member has signed in, and the redirect address checked against what the
  client declared. A client that cannot be verified, or whose document does not declare the redirect
  address, is refused, and the request with it: nothing is sent to an address nobody vouched for
*/
async function loadOAuthAuthorizationRequest(requestId: string): Promise<LoadedRequest> {
  const { data } = await getPendingOAuthAuthorizationRequest(dataConnect, { id: toCanonicalUuid(requestId) })
  const [request] = data.oAuthAuthorizationRequests

  if (!request) return { outcome: 'unknown' }

  const pending = { ...request, state: request.state ?? null }
  const target = parseModuleResource(pending.resource)
  const resolution = await resolveOAuthClient(pending.clientId)

  if (!target || resolution.outcome === 'unknown') return { outcome: 'unknown' }
  if (resolution.outcome === 'refused') return { outcome: 'refused', request: pending, reason: resolution.reason }
  if (!matchesRedirectUri(pending.redirectUri, resolution.client.redirectUris)) {
    return {
      outcome: 'refused',
      request: pending,
      reason: 'The client does not declare the address it asks to be sent back to',
    }
  }

  return { outcome: 'found', request: pending, client: resolution.client, module: target.module }
}

export default loadOAuthAuthorizationRequest
