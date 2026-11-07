import type { ModuleScope, OAuthAuthorizationDecision } from 'strategydance-core'

import { requestApi } from '~data/api'

/*
  Allows an external agent's request as the signed-in member, in the organizations of theirs they
  chose, with the access they chose, and answers where to send the browser: back to the agent with
  its code, or null when the agent could not be verified
*/
async function approveOAuthAuthorizationRequest(requestId: string, organizationIds: string[], scopes: ModuleScope[]) {
  const { redirectUrl } = await requestApi<OAuthAuthorizationDecision>({
    method: 'POST',
    path: `/oauth/requests/${requestId}/approve`,
    body: { organizationIds, scopes },
  })

  return redirectUrl
}

export default approveOAuthAuthorizationRequest
