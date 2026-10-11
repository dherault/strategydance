import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { CompanyAspect } from 'strategydance-database/backend'
import { z } from 'zod'

import { MAX_CONVERSATION_TAGGED_ASPECTS } from '~domain/agent/conversationRequestSettings'

const answerSchema = z.object({ aspects: z.array(z.string()) })

/*
  The aspects the tagging request answered, as `buildConversationTaggingRequest`'s schema has them:
  those `CompanyAspect` knows, each once, the first three, in the order given. Null when it answered
  none, or nothing the schema holds: a refusal its fallback refused too, an answer cut at its
  `max_tokens`, or text that is not the schema's JSON. A fallback carries on the text the declining
  model left, so the answer is the text of every block, joined
*/
function readConversationTagging(message: BetaMessage): CompanyAspect[] | null {
  if (message.stop_reason !== 'end_turn') return null

  const text = message.content.map(block => (block.type === 'text' ? block.text : '')).join('')
  let answer: unknown

  try {
    answer = JSON.parse(text)
  } catch {
    return null
  }

  const parsed = answerSchema.safeParse(answer)

  if (!parsed.success) return null

  const known = new Set<string>(Object.values(CompanyAspect))
  const aspects = [...new Set(parsed.data.aspects)]
    .filter((aspect): aspect is CompanyAspect => known.has(aspect))
    .slice(0, MAX_CONVERSATION_TAGGED_ASPECTS)

  return aspects.length ? aspects : null
}

export default readConversationTagging
