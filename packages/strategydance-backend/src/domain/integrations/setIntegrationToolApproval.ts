import { allowOrganizationIntegrationTool, disallowOrganizationIntegrationTool } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import type { IntegrationCaller } from '~domain/integrations/deleteIntegration'
import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'

/*
  Lets a server's tool run without a member's approval, or takes that back, by the hash of the
  definition the administrator reviewed: a tool the server changed since is refused, as gone
*/
async function setIntegrationToolApproval(caller: IntegrationCaller, definitionHash: string, isAutoApproved: boolean) {
  const variables = { ...caller, definitionHash }

  return (
    (await runIntegrationWrite(() =>
      isAutoApproved
        ? allowOrganizationIntegrationTool(dataConnect, variables)
        : disallowOrganizationIntegrationTool(dataConnect, variables),
    )) ?? ({ outcome: 'saved' } as const)
  )
}

export default setIntegrationToolApproval
