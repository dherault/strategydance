import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ClaudeClient } from '~types'

import { CONVERSATION_MODEL } from '~domain/agent/conversationRequestSettings'
import CONVERSATION_TOOLS from '~domain/agent/conversationTools'
import CONVERSATION_SYSTEM_PROMPT from '~domain/agent/systemPrompt'
import type { ConversationRequestUsage, ConversationRunUsage } from '~domain/conversations/conversationRunUsage'

type MeasureConversationRequestInput = {
  client: ClaudeClient
  // The request's messages, its stored entries first
  messages: BetaMessageParam[]
  // The stored entries, in order, which the first messages are, each with its position and run
  entries: { position: number; runId: string }[]
  // The conversation's latest runs, latest first, each with its ledger, the current run's as it
  // stands
  runs: { id: string; usage: ConversationRunUsage }[]
  // The request a `pause_turn` continuation carries on from, which resends exactly its input and
  // its output; null for any other request
  pausedRequest: ConversationRequestUsage | null
}

// Each client's system prompt and tools, counted once per process
const configTokens = new WeakMap<ClaudeClient, Promise<number>>()

/*
  How many input tokens a request will take, measured before it is sent, without sending it whole
  to the count endpoint when the conversation's usage already knows most of it, and the system
  prompt's and tools' share of it:

  - a `pause_turn` continuation takes the paused request's input, cached included, and its output,
    which is what it resends, the parts held in memory included
  - any other request starts from the latest request whose part is still stored, its run's own
    entry at the position it was stored at, since a retry reuses positions: that request's input
    and output, what follows its part counted alone, and the change in the system prompt's and
    tools' tokens since, which a release can make
  - with no such request, or when what follows does not open with the member's entry, the request
    is counted whole

  What is counted is the request's input alone, never its settings, which the count endpoint refuses
*/
async function measureConversationRequest({
  client,
  messages,
  entries,
  runs,
  pausedRequest,
}: MeasureConversationRequestInput) {
  const config = await countConfigTokens(client)

  if (pausedRequest) return { inputTokens: sumRequest(pausedRequest), configTokens: config }

  const start = findStartingRequest(entries, runs)
  const following = start ? messages.slice(start.index + 1) : []

  // What follows a turn that called tools opens with their results, which the count endpoint
  // refuses without the calls they answer, so such a request is counted whole
  if (!start || following[0]?.role !== 'user' || opensWithResults(following[0])) {
    const inputTokens = await client.countTokens({
      model: CONVERSATION_MODEL,
      system: CONVERSATION_SYSTEM_PROMPT,
      tools: CONVERSATION_TOOLS,
      messages,
    })

    return { inputTokens, configTokens: config }
  }

  const followingTokens = await client.countTokens({ model: CONVERSATION_MODEL, messages: following })

  return {
    inputTokens: sumRequest(start.request) + followingTokens + config - start.request.configTokens,
    configTokens: config,
  }
}

// The latest settled request whose part is still in the transcript, at the index of its entry
function findStartingRequest(
  entries: MeasureConversationRequestInput['entries'],
  runs: MeasureConversationRequestInput['runs'],
) {
  for (const run of runs) {
    for (const request of [...run.usage.requests].reverse()) {
      if (!request.isSettled || request.turnPosition === null) continue

      const index = entries.findIndex(({ position }) => position === request.turnPosition)

      if (index !== -1 && entries[index]?.runId === run.id) return { request, index }
    }
  }

  return null
}

function opensWithResults(message: BetaMessageParam) {
  return Array.isArray(message.content) && message.content.some(block => block.type === 'tool_result')
}

function sumRequest(request: ConversationRequestUsage) {
  return request.inputTokens + request.cacheReadInputTokens + request.cacheCreationInputTokens + request.outputTokens
}

// The system prompt's and tools' share of a request: a request holding them, less one without
function countConfigTokens(client: ClaudeClient) {
  let count = configTokens.get(client)

  if (!count) {
    const messages: BetaMessageParam[] = [{ role: 'user', content: '.' }]

    count = Promise.all([
      client.countTokens({
        model: CONVERSATION_MODEL,
        system: CONVERSATION_SYSTEM_PROMPT,
        tools: CONVERSATION_TOOLS,
        messages,
      }),
      client.countTokens({ model: CONVERSATION_MODEL, messages }),
    ]).then(([withConfig, without]) => withConfig - without)

    count.catch(() => configTokens.delete(client))
    configTokens.set(client, count)
  }

  return count
}

export default measureConversationRequest
