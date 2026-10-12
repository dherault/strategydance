import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ClaudeClient } from '~types'

import type { ConversationRequestTools } from '~domain/agent/buildConversationTools'
import { CONVERSATION_MODEL } from '~domain/agent/conversationRequestSettings'
import replaceConversationFiles, { type ConversationFileTokens } from '~domain/agent/replaceConversationFiles'
import CONVERSATION_SYSTEM_PROMPT from '~domain/agent/systemPrompt'
import type { ConversationRequestUsage, ConversationRunUsage } from '~domain/conversations/conversationRunUsage'

type MeasureConversationRequestInput = {
  client: ClaudeClient
  // The request's messages, its stored entries first
  messages: BetaMessageParam[]
  // The tools it sends, the agent's own and its modules'
  tools: ConversationRequestTools
  // The stored entries, in order, which the first messages are, each with its position and run
  entries: { position: number; runId: string }[]
  // The conversation's latest runs, latest first, each with its ledger, the current run's as it
  // stands
  runs: { id: string; usage: ConversationRunUsage }[]
  // The request a `pause_turn` continuation carries on from, which resends exactly its input and
  // its output; null for any other request
  pausedRequest: ConversationRequestUsage | null
  // What each file the conversation sent takes, by its id in the Files API, counted when it was stored
  fileTokens?: ConversationFileTokens
}

// Each client's system prompt and tools, counted once per process for each list of tools, by its JSON
const configTokens = new WeakMap<ClaudeClient, Map<string, Promise<number>>>()

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

  What is counted is the request's input alone, never its settings, which the count endpoint refuses,
  and never a file, which it refuses by its Files API id: each counts what its upload counted
*/
async function measureConversationRequest({
  client,
  messages,
  tools,
  entries,
  runs,
  pausedRequest,
  fileTokens = new Map(),
}: MeasureConversationRequestInput) {
  const config = await countConfigTokens(client, tools)

  if (pausedRequest) return { inputTokens: sumRequest(pausedRequest), configTokens: config }

  const start = findStartingRequest(entries, runs)
  const following = start ? messages.slice(start.index + 1) : []

  // What follows a turn that called tools opens with their results, which the count endpoint
  // refuses without the calls they answer, so such a request is counted whole
  if (!start || following[0]?.role !== 'user' || opensWithResults(following[0])) {
    const counted = replaceConversationFiles(messages, fileTokens)
    const inputTokens = await client.countTokens({
      model: CONVERSATION_MODEL,
      system: CONVERSATION_SYSTEM_PROMPT,
      tools,
      messages: counted.messages,
    })

    return { inputTokens: inputTokens + counted.fileTokens, configTokens: config }
  }

  const counted = replaceConversationFiles(following, fileTokens)
  const followingTokens = await client.countTokens({ model: CONVERSATION_MODEL, messages: counted.messages })

  return {
    inputTokens: sumRequest(start.request) + followingTokens + counted.fileTokens + config - start.request.configTokens,
    configTokens: config,
  }
}

// The latest settled request whose part is still in the transcript, at the index of its entry
export function findStartingRequest(
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

// A request's whole input, cached or not, which fills the context alike, and its output
export function sumRequest(request: ConversationRequestUsage) {
  return request.inputTokens + request.cacheReadInputTokens + request.cacheCreationInputTokens + request.outputTokens
}

// The system prompt's and tools' share of a request: a request holding them, less one without
export function countConfigTokens(client: ClaudeClient, tools: ConversationRequestTools) {
  const key = JSON.stringify(tools)
  let counts = configTokens.get(client)

  if (!counts) {
    counts = new Map()
    configTokens.set(client, counts)
  }

  let count = counts.get(key)

  if (!count) {
    const messages: BetaMessageParam[] = [{ role: 'user', content: '.' }]

    count = Promise.all([
      client.countTokens({
        model: CONVERSATION_MODEL,
        system: CONVERSATION_SYSTEM_PROMPT,
        tools,
        messages,
      }),
      client.countTokens({ model: CONVERSATION_MODEL, messages }),
    ]).then(([withConfig, without]) => withConfig - without)

    const kept = counts

    count.catch(() => kept.delete(key))
    counts.set(key, count)
  }

  return count
}

export default measureConversationRequest
