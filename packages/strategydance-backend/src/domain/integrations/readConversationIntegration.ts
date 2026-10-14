import { getConversationIntegration } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import parseStoredIntegrationTools from '~domain/integrations/parseStoredIntegrationTools'
import type { ConversationIntegrationCaller } from '~domain/integrations/readConversationIntegrations'

/*
  One live server of the organization as a conversation's agent calls it, its key's ciphertext
  included, with the member's connection to it: `missing` once the membership the run was started
  under is gone, and `unknown` for a server deleted, of another organization, or that never was
*/
async function readConversationIntegration(caller: ConversationIntegrationCaller, integrationId: string) {
  const { data } = await getConversationIntegration(dataConnect, {
    ...caller,
    integrationId: toCanonicalUuid(integrationId),
  })
  const [integration] = data.organizationIntegrations

  if (!data.userOrganizations.length) return { outcome: 'missing' } as const
  if (!integration) return { outcome: 'unknown' } as const

  return {
    outcome: 'found',
    integration: {
      ...integration,
      hasKey: Boolean(integration.encryptedApiKey),
      tools: parseStoredIntegrationTools(integration.tools),
    },
    connection: data.integrationConnections[0] ?? null,
  } as const
}

export default readConversationIntegration
