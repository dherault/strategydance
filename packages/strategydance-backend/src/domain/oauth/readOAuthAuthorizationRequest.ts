import type { ModuleName, ModuleScope, OAuthAuthorizationRequestSummary } from 'strategydance-core'

import isLoopbackRedirectUri from '~domain/oauth/isLoopbackRedirectUri'
import loadOAuthAuthorizationRequest from '~domain/oauth/loadOAuthAuthorizationRequest'

type Reading =
  | { outcome: 'found'; summary: OAuthAuthorizationRequestSummary }
  | { outcome: 'unknown' }
  | { outcome: 'refused'; reason: string }

/*
  What the consent page shows of a request: the client, its name cleaned, marked unverified when
  it registered and with its document's domain otherwise, never its logo; the host the member will
  be sent back to, and whether it is only a loopback address, which any program on the member's
  computer could be listening on; the module, and the access asked for
*/
async function readOAuthAuthorizationRequest(requestId: string): Promise<Reading> {
  const loaded = await loadOAuthAuthorizationRequest(requestId)

  if (loaded.outcome === 'unknown') return loaded
  if (loaded.outcome === 'refused') return { outcome: 'refused', reason: loaded.reason }

  const { request, client, module } = loaded

  return {
    outcome: 'found',
    summary: {
      client: { name: client.name, isVerified: client.isVerified, domain: client.domain },
      redirectHost: new URL(request.redirectUri).host,
      isLoopbackRedirect: isLoopbackRedirectUri(request.redirectUri),
      module: module.name as ModuleName,
      scopes: request.scopes as ModuleScope[],
      expiresAt: request.expiresAt,
    },
  }
}

export default readOAuthAuthorizationRequest
