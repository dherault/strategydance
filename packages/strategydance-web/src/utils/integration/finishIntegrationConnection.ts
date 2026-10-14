import { requestApi } from '~data/api'

/*
  Finishes the reader's Connect their sign-in came back with, which the backend does for the account
  that started it alone. Called by the page the sign-in ends on, which no organization's path leads
  to, so it names the organization the callback named
*/
function finishIntegrationConnection(organizationId: string, integrationId: string, authorizationId: string) {
  return requestApi({
    method: 'POST',
    path: `/organizations/${organizationId}/integrations/${integrationId}/connection/finish`,
    body: { authorizationId },
  })
}

export default finishIntegrationConnection
