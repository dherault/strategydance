import { setOrganizationIntegrationEnabled } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import type { IntegrationCaller } from '~domain/integrations/deleteIntegration'
import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'

// Turns a server on or off for the agent, keeping everything else
async function setIntegrationEnabled(caller: IntegrationCaller, isEnabled: boolean) {
  return (
    (await runIntegrationWrite(() => setOrganizationIntegrationEnabled(dataConnect, { ...caller, isEnabled })))
    ?? ({ outcome: 'saved' } as const)
  )
}

export default setIntegrationEnabled
