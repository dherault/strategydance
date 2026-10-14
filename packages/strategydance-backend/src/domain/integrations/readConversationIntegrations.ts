import type { IntegrationTool } from 'strategydance-core'
import {
  getConversationIntegrations,
  type GetConversationIntegrationsData,
  type IntegrationAuthentication,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import parseStoredIntegrationTools from '~domain/integrations/parseStoredIntegrationTools'

// Who a conversation's agent acts as: the run's member, in the membership the run was started under
type ConversationIntegrationCaller = {
  organizationId: string
  userId: string
  membershipCreatedAt: string
}

type ConversationIntegrationSummary = {
  id: string
  name: string
  authentication: IntegrationAuthentication
  isEnabled: boolean
  configRevision: number
  keyGeneration: number
  hasKey: boolean
  tools: IntegrationTool[] | null
  autoApprovedTools: string[]
  connection: GetConversationIntegrationsData['integrationConnections'][number] | null
}

/*
  The organization's live servers as a conversation's agent sees them for its member, in the order
  they were added, each with that member's connection, or null once the membership the run was
  started under is gone
*/
async function readConversationIntegrations(
  caller: ConversationIntegrationCaller,
): Promise<ConversationIntegrationSummary[] | null> {
  const { data } = await getConversationIntegrations(dataConnect, caller)

  if (!data.userOrganizations.length) return null

  const connections = new Map(
    data.integrationConnections.map(connection => [toCanonicalUuid(connection.integrationId), connection]),
  )

  return data.organizationIntegrations.map(integration => ({
    id: integration.id,
    name: integration.name,
    authentication: integration.authentication,
    isEnabled: integration.isEnabled,
    configRevision: integration.configRevision,
    keyGeneration: integration.keyGeneration,
    hasKey: Boolean(integration.apiKeyLastFour),
    tools: parseStoredIntegrationTools(integration.tools),
    autoApprovedTools: integration.autoApprovedTools,
    connection: connections.get(toCanonicalUuid(integration.id)) ?? null,
  }))
}

export { type ConversationIntegrationCaller, type ConversationIntegrationSummary }

export default readConversationIntegrations
