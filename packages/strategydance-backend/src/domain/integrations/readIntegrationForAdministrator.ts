import { getOrganizationIntegrationForAdministrator } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

// A server of the organization as its administrators' routes change it, deleted or not, or null
async function readIntegrationForAdministrator(organizationId: string, integrationId: string) {
  const { data } = await getOrganizationIntegrationForAdministrator(dataConnect, { organizationId, integrationId })

  return data.organizationIntegrations[0] ?? null
}

type StoredIntegration = NonNullable<Awaited<ReturnType<typeof readIntegrationForAdministrator>>>

export { type StoredIntegration }

export default readIntegrationForAdministrator
