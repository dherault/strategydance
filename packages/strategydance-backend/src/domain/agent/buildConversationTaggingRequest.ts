import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { CompanyAspect } from 'strategydance-database/backend'

import type { ConversationContentBlock } from '~types'

import {
  CONVERSATION_MODEL,
  CONVERSATION_TAGGING_BETAS,
  CONVERSATION_TAGGING_MAX_TOKENS,
  MAX_CONVERSATION_TAGGING_TEXT_LENGTH,
} from '~domain/agent/conversationRequestSettings'
import { ASK_USER_TOOL_NAME } from '~domain/agent/conversationTools'
import CONVERSATION_TAGGING_PROMPT from '~domain/agent/taggingPrompt'

type ConversationExchange = {
  // The member's first message, as the transcript keeps it
  member: ConversationContentBlock[]
  // The reply that answered it, its parts in order
  reply: ConversationContentBlock[]
}

/*
  What the answer holds: the aspects, each one of `CompanyAspect`'s. The API takes no bound on an
  array's length, so the reader keeps three at most
*/
export const CONVERSATION_TAGGING_SCHEMA = {
  type: 'object',
  properties: {
    aspects: {
      type: 'array',
      description: 'The one to three aspects the exchange is most about, the most relevant first',
      items: { type: 'string', enum: Object.values(CompanyAspect) },
    },
  },
  required: ['aspects'],
  additionalProperties: false,
}

/*
  The request that tags a conversation with the aspects of the company its first exchange is about:
  Opus 5.5 at low effort, the API's fallback on a refusal, as the run's own requests have it, no
  tools, and its answer held to a schema (structured output), which `readConversationTagging` reads.
  It quotes the member's message and the reply's words, its text and the questions it asked, each
  cut to 8000 characters, since what an exchange is about shows long before that
*/
function buildConversationTaggingRequest({ member, reply }: ConversationExchange): BetaMessageStreamParams {
  const text = [
    '<member_message>',
    cut(readWords(member)),
    '</member_message>',
    '',
    '<strategy_dance_reply>',
    cut(readWords(reply)),
    '</strategy_dance_reply>',
  ].join('\n')

  return {
    model: CONVERSATION_MODEL,
    max_tokens: CONVERSATION_TAGGING_MAX_TOKENS,
    betas: [...CONVERSATION_TAGGING_BETAS],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: CONVERSATION_TAGGING_SCHEMA } },
    system: CONVERSATION_TAGGING_PROMPT,
    messages: [{ role: 'user', content: [{ type: 'text', text }] }],
  }
}

// The words of a message: its text, and the prompt of each question it asked
function readWords(blocks: ConversationContentBlock[]) {
  return blocks
    .flatMap(block => {
      if (block.type === 'text' && typeof block.text === 'string') return [block.text]
      if (block.type === 'tool_use' && block.name === ASK_USER_TOOL_NAME) {
        const prompt = (block.input as { prompt?: unknown } | undefined)?.prompt

        return typeof prompt === 'string' ? [prompt] : []
      }

      return []
    })
    .join('\n\n')
    .trim()
}

// At most 8000 characters, cut between two of them, so no character is split
function cut(text: string) {
  const characters = Array.from(text)

  return characters.length > MAX_CONVERSATION_TAGGING_TEXT_LENGTH
    ? `${characters.slice(0, MAX_CONVERSATION_TAGGING_TEXT_LENGTH).join('')}…`
    : text
}

export default buildConversationTaggingRequest
