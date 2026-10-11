import type { ModuleScope, OAuthAuthorizationDecision } from 'strategydance-core'

import { requestApi } from '~data/api'

/*
  Allows an external agent's request as the signed-in member, in one of their organizations, with
  the access they chose, and answers where to send the browser: back to the agent with its code, or
  null when the agent could not be verified
*/
async function approveOAuthAuthorizationRequest(requestId: string, organizationId: string, scopes: ModuleScope[]) {
  const { redirectUrl } = await requestApi<OAuthAuthorizationDecision>({
    method: 'POST',
    path: `/oauth/requests/${requestId}/approve`,
    body: { organizationId, scopes },
  })

  return redirectUrl
}

export default approveOAuthAuthorizationRequest
