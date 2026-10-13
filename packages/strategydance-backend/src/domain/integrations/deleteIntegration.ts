import { deleteOrganizationIntegration } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'

type IntegrationCaller = { organizationId: string; userId: string; integrationId: string }

// Deletes a server, its key kept for an Undo within a day, and prunes the organization's older ones
async function deleteIntegration(caller: IntegrationCaller) {
  return (
    (await runIntegrationWrite(() => deleteOrganizationIntegration(dataConnect, caller)))
    ?? ({ outcome: 'saved' } as const)
  )
}

export { type IntegrationCaller }

export default deleteIntegration
