import type { IntegrationTool } from 'strategydance-core'
import type { IntegrationAuthentication, IntegrationConnectionStatus } from 'strategydance-database/backend'

import type { ConversationIntegrationCall } from '~domain/agent/checkConversationIntegrationCall'
import describeIntegrationUnavailability from '~domain/integrations/describeIntegrationUnavailability'
import readIntegrationAvailability from '~domain/integrations/readIntegrationAvailability'

// The server and the tool a call goes to, as the thread names them, at call time
export type DrawnIntegration = {
  id: string
  name: string
  toolName: string
}

// What a call's approval, or its running without one, is bound to
export type DrawnIntegrationBinding = {
  configRevision: number
  toolHash: string
  credentialGeneration: string | null
}

// The server as a call reads it when it is drawn, or why there is none
type IntegrationRead =
  | { outcome: 'missing' | 'unknown' }
  | {
      outcome: 'found'
      integration: {
        id: string
        name: string
        authentication: IntegrationAuthentication
        isEnabled: boolean
        configRevision: number
        keyGeneration: number
        hasKey: boolean
        tools: IntegrationTool[] | null
        autoApprovedTools: string[]
      }
      connection: { generation: string; configRevision: number; status: IntegrationConnectionStatus } | null
    }

// Why a subagent's call that would wait for an approval is refused, which its report then proposes
export const SUBAGENT_APPROVAL_REFUSAL =
  "Not called: this call needs the member's approval, which nobody can give a subagent. Say in your report what you would call, with which arguments, and why."

/*
  What a call to an integration's tool becomes when it is drawn, from the server as it is then,
  decided once, since the message drawn keeps it for a worker taking over:

  - `refused`: the member cannot use the server, or it has no such tool, answered with why, and
    drawn with the server it named when there is one, so the thread can say what fixes it
  - `run`: an administrator lets the tool run without approval, so it runs at once
  - `approval`: it waits for the member's Allow, or, a subagent's, is refused, since nobody can give
    one, so the subagent never waits, and says in its report what it would call for its parent to
    propose

  Both `run` and `approval` are bound to the server's revision, the tool's definition and the
  credential's generation as they are now, which the call checks again right before it is made
*/
function decideConversationIntegrationCall(
  read: IntegrationRead,
  call: ConversationIntegrationCall,
  { isSubagent = false }: { isSubagent?: boolean } = {},
) {
  if (read.outcome !== 'found') {
    return {
      kind: 'refused',
      reason: `Not called: there is no integration with the id ${call.integrationId}. Call list_integrations for the organization's integrations.`,
      integration: null,
    } as const
  }

  const { integration, connection } = read
  const drawn: DrawnIntegration = {
    id: integration.id,
    name: withoutNul(integration.name),
    toolName: withoutNul(call.toolName),
  }
  const availability = readIntegrationAvailability(integration, connection)

  if (availability.outcome !== 'available') {
    return {
      kind: 'refused',
      reason: `Not called: ${describeIntegrationUnavailability(integration.name, availability.outcome)}`,
      integration: drawn,
    } as const
  }

  const tool = integration.tools?.find(({ name }) => name === call.toolName)

  if (!tool) {
    return {
      kind: 'refused',
      reason: `Not called: ${integration.name} has no tool called ${call.toolName}. Call list_integrations for its tools.`,
      integration: drawn,
    } as const
  }

  const binding: DrawnIntegrationBinding = {
    configRevision: integration.configRevision,
    toolHash: tool.definitionHash,
    credentialGeneration: availability.credentialGeneration,
  }

  if (integration.autoApprovedTools.includes(tool.definitionHash)) {
    return { kind: 'run', integration: drawn, binding } as const
  }

  if (isSubagent) return { kind: 'refused', reason: SUBAGENT_APPROVAL_REFUSAL, integration: drawn } as const

  return { kind: 'approval', integration: drawn, binding } as const
}

// A name as a Postgres text column takes it, which refuses U+0000
function withoutNul(text: string) {
  return text.replaceAll('\u0000', '')
}

export default decideConversationIntegrationCall
