import type { OAuthAuthorizationDecision } from 'strategydance-core'

import { requestApi } from '~data/api'

/*
  Refuses an external agent's request, and answers where to send the browser: back to the agent,
  telling it the member said no, or null when the agent could not be verified, which leaves the
  member on the page
*/
async function denyOAuthAuthorizationRequest(requestId: string) {
  const { redirectUrl } = await requestApi<OAuthAuthorizationDecision>({
    method: 'POST',
    path: `/oauth/requests/${requestId}/deny`,
  })

  return redirectUrl
}

export default denyOAuthAuthorizationRequest
