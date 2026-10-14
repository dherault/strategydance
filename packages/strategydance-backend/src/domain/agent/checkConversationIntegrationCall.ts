import { z } from 'zod'

import { MAX_INTEGRATION_CALL_ARGUMENTS_LENGTH } from '~constants'

// An integration's id as list_integrations gives it, hyphenated or not
export const INTEGRATION_ID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

const INTEGRATION_CALL_SCHEMA = z.object({
  integration: z.string(),
  tool: z.string(),
  arguments: z.record(z.string(), z.unknown()),
})

// A call to an integration's tool, as the worker draws and makes it
export type ConversationIntegrationCall = {
  integrationId: string
  toolName: string
  arguments: Record<string, unknown>
}

/*
  Checks a `call_integration_tool` call's input before anything of it is drawn, since the tool is not
  strict and Claude's input streams in unchecked: an integration's id, a tool's name and its
  arguments as an object, at most 100000 characters as JSON, so an approval never shows the member
  arguments too long to read whole. A call that fails is drawn as failed, its result saying why, from
  its input alone, so whoever answers the turn says the same
*/
function checkConversationIntegrationCall(
  input: unknown,
): { outcome: 'valid'; call: ConversationIntegrationCall } | { outcome: 'invalid'; reason: string } {
  const parsed = INTEGRATION_CALL_SCHEMA.safeParse(input)

  if (!parsed.success) {
    return invalid(
      "it takes the integration's id, the tool's name and the tool's arguments as an object. Call it again with all three",
    )
  }

  const { integration, tool, arguments: args } = parsed.data

  if (!INTEGRATION_ID_PATTERN.test(integration)) {
    return invalid('the integration is named by the id list_integrations gives. Call list_integrations for it')
  }

  if (!tool.trim()) return invalid('it takes the name of the tool, as list_integrations gives it')

  if (JSON.stringify(args).length > MAX_INTEGRATION_CALL_ARGUMENTS_LENGTH) {
    return invalid(
      `its arguments hold at most ${MAX_INTEGRATION_CALL_ARGUMENTS_LENGTH} characters as JSON, which the member reads before allowing it. Ask for less`,
    )
  }

  return { outcome: 'valid', call: { integrationId: integration, toolName: tool, arguments: args } }
}

function invalid(rule: string) {
  return { outcome: 'invalid' as const, reason: `Not called: ${rule}.` }
}

export default checkConversationIntegrationCall
