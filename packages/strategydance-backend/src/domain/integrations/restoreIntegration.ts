import { restoreOrganizationIntegration } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import type { IntegrationCaller } from '~domain/integrations/deleteIntegration'
import readIntegrationForAdministrator from '~domain/integrations/readIntegrationForAdministrator'
import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'

/*
  Takes a server's delete back within a day, under the organization's limit and names: the name it
  held is what the restore matches, so one renamed since is refused as gone rather than restored
  under a name nobody checked
*/
async function restoreIntegration(caller: IntegrationCaller) {
  const stored = await readIntegrationForAdministrator(caller.organizationId, caller.integrationId)

  if (!stored?.deletedAt) return { outcome: 'gone' } as const

  return (
    (await runIntegrationWrite(() =>
      restoreOrganizationIntegration(dataConnect, { ...caller, normalizedName: stored.normalizedName }),
    )) ?? ({ outcome: 'saved' } as const)
  )
}

export default restoreIntegration
