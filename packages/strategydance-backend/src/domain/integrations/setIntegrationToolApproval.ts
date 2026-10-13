import { allowOrganizationIntegrationTool, disallowOrganizationIntegrationTool } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import type { IntegrationCaller } from '~domain/integrations/deleteIntegration'
import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'

/*
  Lets a server's tool run without a member's approval, or takes that back, by the hash of the
  definition the administrator reviewed, at the configuration its tools were shown under: a tool the
  server changed since, or a server reconfigured since, is refused as a conflict
*/
async function setIntegrationToolApproval(
  caller: IntegrationCaller,
  {
    definitionHash,
    isAutoApproved,
    configRevision,
  }: { definitionHash: string; isAutoApproved: boolean; configRevision: number },
) {
  const variables = { ...caller, definitionHash, configRevision }

  return (
    (await runIntegrationWrite(() =>
      isAutoApproved
        ? allowOrganizationIntegrationTool(dataConnect, variables)
        : disallowOrganizationIntegrationTool(dataConnect, variables),
    )) ?? ({ outcome: 'saved' } as const)
  )
}

export default setIntegrationToolApproval
