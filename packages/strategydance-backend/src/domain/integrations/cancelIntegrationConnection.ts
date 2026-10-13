import { cancelIntegrationAuthorization } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

type CancelIntegrationConnectionParameters = {
  organizationId: string
  userId: string
  integrationId: string
}

// Cancels a member's Connect under way, so a sign-in finished in its window afterwards connects
// nothing. A Connect finished or gone already is answered as canceled all the same
async function cancelIntegrationConnection(caller: CancelIntegrationConnectionParameters) {
  await cancelIntegrationAuthorization(dataConnect, caller)

  return { outcome: 'canceled' } as const
}

export default cancelIntegrationConnection
