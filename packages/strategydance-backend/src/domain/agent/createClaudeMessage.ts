import type { BetaContentBlock, BetaMessage, BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import { CONVERSATION_MODEL } from '~domain/agent/conversationRequestSettings'

type ClaudeMessageInput = {
  content: BetaContentBlock[]
  stopReason?: BetaStopReason
  model?: string
  usage?: {
    inputTokens?: number
    cacheReadInputTokens?: number
    cacheCreationInputTokens?: number
    outputTokens?: number
    webSearchRequests?: number
  }
}

/*
  A final message as Claude's API answers one, for what stands in for it: the placeholder client in
  development and the tests' scripted one. Every field the SDK types is there, at what a plain reply
  carries
*/
function createClaudeMessage({
  content,
  stopReason = 'end_turn',
  model = CONVERSATION_MODEL,
  usage = {},
}: ClaudeMessageInput): BetaMessage {
  return {
    id: `msg_${crypto.randomUUID().replaceAll('-', '')}`,
    container: null,
    content,
    context_management: null,
    diagnostics: null,
    model,
    role: 'assistant',
    stop_details: null,
    stop_reason: stopReason,
    stop_sequence: null,
    type: 'message',
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: usage.cacheCreationInputTokens ?? 0,
      cache_read_input_tokens: usage.cacheReadInputTokens ?? 0,
      fallback_credit: null,
      inference_geo: null,
      input_tokens: usage.inputTokens ?? 0,
      iterations: null,
      output_tokens: usage.outputTokens ?? 0,
      output_tokens_details: null,
      server_tool_use: { web_fetch_requests: 0, web_search_requests: usage.webSearchRequests ?? 0 },
      service_tier: 'standard',
      speed: null,
    },
  }
}

export default createClaudeMessage
