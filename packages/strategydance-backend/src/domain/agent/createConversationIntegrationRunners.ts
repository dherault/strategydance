import { z } from 'zod'

import type { ConversationToolRunner } from '~types'

import checkConversationIntegrationCall, {
  INTEGRATION_ID_PATTERN,
} from '~domain/agent/checkConversationIntegrationCall'
import {
  CALL_INTEGRATION_TOOL_TOOL_NAME,
  DESCRIBE_INTEGRATION_TOOL_TOOL_NAME,
  LIST_INTEGRATIONS_TOOL_NAME,
} from '~domain/agent/conversationTools'
import toConversationIntegrationList from '~domain/agent/toConversationIntegrationList'
import callIntegrationTool from '~domain/integrations/callIntegrationTool'
import type { IntegrationNetwork } from '~domain/integrations/createIntegrationFetch'
import describeIntegrationUnavailability from '~domain/integrations/describeIntegrationUnavailability'
import readConversationIntegration from '~domain/integrations/readConversationIntegration'
import readConversationIntegrations, {
  type ConversationIntegrationCaller,
} from '~domain/integrations/readConversationIntegrations'
import readIntegrationAvailability from '~domain/integrations/readIntegrationAvailability'

const DESCRIBE_SCHEMA = z.object({ integration: z.string(), tool: z.string() })

// What a removed member's run reads of the organization's servers: nothing, as it does no more
const MEMBERSHIP_GONE = 'The member is no longer in this organization, so its integrations cannot be used.'

/*
  The agent's three integration tools, as a run's worker runs them for its member, in the membership
  the run was started under, which every read matches: the list and a tool's description read the
  database alone, side by side as reads do, and a call goes to the server, alone, as a write does,
  only as the message it was drawn as allows. Always these three, whatever the organization added,
  so a run plans a turn the same whoever takes it over
*/
function createConversationIntegrationRunners(
  caller: ConversationIntegrationCaller,
  { network }: { network?: IntegrationNetwork } = {},
): ConversationToolRunner[] {
  return [
    {
      name: LIST_INTEGRATIONS_TOOL_NAME,
      isReadOnly: true,
      async run() {
        const servers = await readConversationIntegrations(caller)

        if (!servers) throw new Error(MEMBERSHIP_GONE)

        return toConversationIntegrationList(servers)
      },
    },
    {
      name: DESCRIBE_INTEGRATION_TOOL_TOOL_NAME,
      isReadOnly: true,
      async run(input) {
        const parsed = DESCRIBE_SCHEMA.safeParse(input)

        if (!parsed.success || !INTEGRATION_ID_PATTERN.test(parsed.data.integration)) {
          throw new Error(
            "It takes the integration's id and the tool's name, as list_integrations gives them. Call list_integrations for them.",
          )
        }

        const { integration: integrationId, tool: toolName } = parsed.data
        const read = await readConversationIntegration(caller, integrationId)

        if (read.outcome === 'missing') throw new Error(MEMBERSHIP_GONE)
        if (read.outcome === 'unknown') {
          throw new Error(
            `There is no integration with the id ${integrationId}. Call list_integrations for the organization's integrations.`,
          )
        }

        const { integration, connection } = read
        const tool = integration.tools?.find(({ name }) => name === toolName)

        if (!tool) {
          throw new Error(`${integration.name} has no tool called ${toolName}. Call list_integrations for its tools.`)
        }

        const availability = readIntegrationAvailability(integration, connection)

        return {
          integration: { id: integration.id, name: integration.name },
          works: availability.outcome === 'available',
          ...(availability.outcome !== 'available' && {
            why: describeIntegrationUnavailability(integration.name, availability.outcome),
          }),
          tool: {
            name: tool.name,
            ...(tool.title && { title: tool.title }),
            ...(tool.description && { description: tool.description }),
            inputSchema: tool.inputSchema,
            ...(tool.annotations && { annotations: tool.annotations }),
            runsWithoutApproval: integration.autoApprovedTools.includes(tool.definitionHash),
          },
        }
      },
    },
    {
      name: CALL_INTEGRATION_TOOL_TOOL_NAME,
      isReadOnly: false,
      async run(input, { signal, message }) {
        const checked = checkConversationIntegrationCall(input)

        if (checked.outcome === 'invalid') throw new Error(checked.reason)

        // Only a call drawn with what it is bound to runs: one that runs without approval, or one allowed
        if (
          !message?.integrationId
          || message.approvalConfigRevision === null
          || message.approvalConfigRevision === undefined
          || !message.approvalToolHash
        ) {
          throw new Error('Not called: the call was never allowed. Propose it again.')
        }

        return callIntegrationTool(
          caller,
          {
            integrationId: message.integrationId,
            toolName: checked.call.toolName,
            arguments: checked.call.arguments,
            binding: {
              configRevision: message.approvalConfigRevision,
              toolHash: message.approvalToolHash,
              credentialGeneration: message.approvalCredentialGeneration ?? null,
            },
            isAutoApproved: message.approvalState === null || message.approvalState === undefined,
          },
          { signal, network },
        )
      },
    },
  ]
}

export default createConversationIntegrationRunners
