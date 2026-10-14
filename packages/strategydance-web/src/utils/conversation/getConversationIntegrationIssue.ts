import { IntegrationAuthentication, IntegrationConnectionStatus } from 'strategydance-database/web'

type IssueIntegration = {
  id: string
  isEnabled: boolean
  authentication: IntegrationAuthentication
}

type IssueConnection = {
  integrationId: string
  status: IntegrationConnectionStatus
}

/*
  What keeps the server a call went to from working for the reader now, which the thread says under
  the call with what fixes it, matched in the organization's live list by the server's id, never its
  name: gone from the list, deleted or pruned; turned off; or taking each member's own account, which
  the reader has not connected, or has to connect again. Null while it works
*/
function getConversationIntegrationIssue(
  integrationId: string | null | undefined,
  integrations: IssueIntegration[],
  connections: IssueConnection[],
) {
  const integration = integrationId ? integrations.find(({ id }) => id === integrationId) : undefined

  if (!integration) return 'missing'
  if (!integration.isEnabled) return 'off'

  const isConnected = connections.some(
    connection =>
      connection.integrationId === integration.id && connection.status === IntegrationConnectionStatus.CONNECTED,
  )

  if (integration.authentication === IntegrationAuthentication.OAUTH && !isConnected) return 'notConnected'

  return null
}

type ConversationIntegrationIssue = NonNullable<ReturnType<typeof getConversationIntegrationIssue>>

export { type ConversationIntegrationIssue }

export default getConversationIntegrationIssue
