import type {
  BetaContentBlock,
  BetaMessageParam,
  BetaMessageStreamParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { ConversationTranscriptRole } from 'strategydance-database/backend'

import type { ConversationContentBlock } from '~types'

import {
  CONVERSATION_BETAS,
  CONVERSATION_MAX_TOKENS,
  CONVERSATION_MODEL,
} from '~domain/agent/conversationRequestSettings'
import CONVERSATION_TOOLS from '~domain/agent/conversationTools'
import CONVERSATION_SYSTEM_PROMPT from '~domain/agent/systemPrompt'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'

// A transcript entry as the request replays it: its role, and its content as the JSON text it
// was sent as
export type ConversationRequestEntry = {
  role: ConversationTranscriptRole
  content: string
}

type BuildConversationMessagesInput = {
  // The stored transcript, in order
  entries: ConversationRequestEntry[]
  // The run's context message, sent last until it is stored with the run's first part, or null
  // once it is
  context: ConversationContentBlock[] | null
  // The parts of a turn `pause_turn` paused, held in memory until the turn ends, sent back as
  // they came
  parts: BetaContentBlock[][]
}

const ROLES = {
  [ConversationTranscriptRole.USER]: 'user',
  [ConversationTranscriptRole.ASSISTANT]: 'assistant',
  [ConversationTranscriptRole.SYSTEM]: 'system',
} as const

/*
  A request's messages: every stored entry, its content parsed from the JSON text it was stored as
  and so sent again as the same bytes, then the run's context message while it is not stored, then
  the paused parts of the turn in flight
*/
export function buildConversationMessages({ entries, context, parts }: BuildConversationMessagesInput) {
  const messages: BetaMessageParam[] = entries.map(entry => ({
    role: ROLES[entry.role],
    content: parseTranscriptContent(entry.content) as BetaMessageParam['content'],
  }))

  if (context) messages.push({ role: 'system', content: context as BetaMessageParam['content'] })

  for (const part of parts) messages.push({ role: 'assistant', content: part as BetaMessageParam['content'] })

  return messages
}

/*
  A run's request to Claude, as M1's probe settled it: Opus 5.5 with adaptive thinking, its progress
  lines (`display: "updates"`) and `drop_block` for a thinking block whose history changed, medium
  effort, the API's fallback on a refusal, the frozen system prompt with its own cache breakpoint
  and the tail cached at the top level, the frozen tools, then the messages. Every request is built
  here, in one key order, so consecutive requests share their bytes up to where they differ
*/
function buildConversationRequest(messages: BetaMessageParam[]): BetaMessageStreamParams {
  return {
    model: CONVERSATION_MODEL,
    max_tokens: CONVERSATION_MAX_TOKENS,
    betas: [...CONVERSATION_BETAS],
    thinking: { type: 'adaptive', display: 'updates', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    cache_control: { type: 'ephemeral' },
    system: [{ type: 'text', text: CONVERSATION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: CONVERSATION_TOOLS,
    messages,
  }
}

export default buildConversationRequest
