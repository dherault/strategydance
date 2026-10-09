import { describe, expect, test } from 'bun:test'

import type { BetaMessageParam, MessageCountTokensParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import createClaudeMessage from '~domain/agent/createClaudeMessage'
import createScriptedClaudeClient from '~domain/agent/testing/createScriptedClaudeClient'
import {
  parseConversationRunUsage,
  reserveConversationRequest,
  settleConversationRequest,
} from '~domain/conversations/conversationRunUsage'

import measureConversationRequest from './measureConversationRequest'

const RUN_ID = 'run'

const member: BetaMessageParam = { role: 'user', content: [{ type: 'text', text: 'Price the beta' }] }
const context: BetaMessageParam = { role: 'system', content: [{ type: 'text', text: 'Context' }] }
const reply: BetaMessageParam = { role: 'assistant', content: [{ type: 'text', text: 'Flat 19 per month' }] }

/*
  A count endpoint whose system prompt and tools take `config` tokens, the request without them 10,
  and every message 100
*/
function createCounter(config = 1000) {
  return (body: MessageCountTokensParams) => {
    const isBaseline = body.messages.length === 1 && body.messages[0]?.content === '.'

    return (body.system ? config : 0) + (isBaseline ? 10 : body.messages.length * 100)
  }
}

// A run's ledger with one request settled, its part stored at `turnPosition`
function settledUsage(turnPosition: number, configTokens = 1000) {
  const { usage, index } = reserveConversationRequest(parseConversationRunUsage(null), {
    estimatedInputTokens: 0,
    configTokens,
    inputEndPosition: turnPosition - 1,
  })

  return settleConversationRequest(
    usage,
    index,
    createClaudeMessage({ content: [], usage: { inputTokens: 5000, cacheReadInputTokens: 20000, outputTokens: 700 } }),
    { turnPosition },
  )
}

const call: BetaMessageParam = {
  role: 'assistant',
  content: [{ type: 'tool_use', id: 'toolu_1', name: 'read_log', input: {} }],
}
const results: BetaMessageParam = {
  role: 'user',
  content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '[]' }],
}

describe('measureConversationRequest', () => {
  test('counts a conversation’s first request whole, and the system prompt’s and tools’ share once', async () => {
    const scripted = createScriptedClaudeClient({ count: createCounter() })
    const measured = await measureConversationRequest({
      client: scripted.client,
      messages: [member, context],
      entries: [{ position: 0, runId: RUN_ID }],
      runs: [{ id: RUN_ID, usage: parseConversationRunUsage(null) }],
      pausedRequest: null,
    })

    expect(measured).toEqual({ inputTokens: 1200, configTokens: 1000 })
    expect(scripted.counts).toHaveLength(3)
  })

  test('counts whole a request after a turn that called tools, whose results the count refuses alone', async () => {
    const scripted = createScriptedClaudeClient({ count: createCounter() })
    const measured = await measureConversationRequest({
      client: scripted.client,
      messages: [member, context, call, results],
      entries: [
        { position: 0, runId: RUN_ID },
        { position: 1, runId: RUN_ID },
        { position: 2, runId: RUN_ID },
        { position: 3, runId: RUN_ID },
      ],
      runs: [{ id: RUN_ID, usage: settledUsage(2) }],
      pausedRequest: null,
    })

    expect(measured).toEqual({ inputTokens: 1400, configTokens: 1000 })
  })

  test('starts from the latest stored reply’s request, and counts only what follows it', async () => {
    const scripted = createScriptedClaudeClient({ count: createCounter() })
    const measured = await measureConversationRequest({
      client: scripted.client,
      messages: [member, context, reply, member, context],
      entries: [
        { position: 0, runId: 'earlier' },
        { position: 1, runId: 'earlier' },
        { position: 2, runId: 'earlier' },
        { position: 3, runId: RUN_ID },
      ],
      runs: [
        { id: RUN_ID, usage: parseConversationRunUsage(null) },
        { id: 'earlier', usage: settledUsage(2, 1000) },
      ],
      pausedRequest: null,
    })

    // 25700 for the earlier request, 200 for the member's entry and the context after it
    expect(measured.inputTokens).toBe(25900)
    expect(scripted.counts.at(-1)?.messages).toEqual([member, context])
  })

  test('counts a release’s growth of the system prompt and tools', async () => {
    const scripted = createScriptedClaudeClient({ count: createCounter(3000) })
    const measured = await measureConversationRequest({
      client: scripted.client,
      messages: [member, context, reply, member, context],
      entries: [0, 1, 2, 3].map(position => ({ position, runId: position < 3 ? 'earlier' : RUN_ID })),
      runs: [{ id: 'earlier', usage: settledUsage(2, 1000) }],
      pausedRequest: null,
    })

    // The tools grew by 2000 tokens since the earlier request
    expect(measured.inputTokens).toBe(25900 + 2000)
  })

  test('counts whole when the stored reply’s position now holds another run’s entry', async () => {
    const scripted = createScriptedClaudeClient({ count: createCounter() })
    const measured = await measureConversationRequest({
      client: scripted.client,
      messages: [member, context, reply],
      entries: [0, 1, 2].map(position => ({ position, runId: RUN_ID })),
      runs: [{ id: 'retried', usage: settledUsage(2) }],
      pausedRequest: null,
    })

    expect(measured.inputTokens).toBe(1300)
  })

  test('counts a continuation from the request it carries on, with nothing counted', async () => {
    const scripted = createScriptedClaudeClient({ count: createCounter() })
    const usage = settledUsage(2)
    const measured = await measureConversationRequest({
      client: scripted.client,
      messages: [member, context, reply],
      entries: [{ position: 0, runId: RUN_ID }],
      runs: [{ id: RUN_ID, usage }],
      pausedRequest: usage.requests[0] ?? null,
    })

    expect(measured.inputTokens).toBe(25700)
    expect(scripted.counts).toHaveLength(2)
  })
})
