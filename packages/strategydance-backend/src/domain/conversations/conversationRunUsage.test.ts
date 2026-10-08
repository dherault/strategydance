import { describe, expect, test } from 'bun:test'

import createClaudeMessage from '~domain/agent/createClaudeMessage'

import {
  chargeUnsettledRequests,
  parseConversationRunUsage,
  reserveConversationRequest,
  settleConversationRequest,
} from './conversationRunUsage'

const RESERVATION = { estimatedInputTokens: 1200, configTokens: 300, inputEndPosition: 0 }

function answer(model: string, usage: Parameters<typeof createClaudeMessage>[0]['usage']) {
  return createClaudeMessage({ content: [], model, usage })
}

describe('the run’s usage ledger', () => {
  test('reserves a request unsettled, then settles it from its answer', () => {
    const { usage, index } = reserveConversationRequest(parseConversationRunUsage(null), RESERVATION)

    expect(usage.requests[index]).toMatchObject({ isSettled: false, estimatedInputTokens: 1200, model: null })
    expect(usage.byModel).toEqual({})

    const settled = settleConversationRequest(
      usage,
      index,
      answer('claude-opus-5-5', {
        inputTokens: 10,
        cacheReadInputTokens: 1100,
        outputTokens: 80,
        webSearchRequests: 2,
      }),
      { turnPosition: 2 },
    )

    expect(settled.requests[index]).toMatchObject({
      model: 'claude-opus-5-5',
      stopReason: 'end_turn',
      inputTokens: 10,
      cacheReadInputTokens: 1100,
      outputTokens: 80,
      webSearchRequests: 2,
      turnPosition: 2,
      isSettled: true,
      isEstimated: false,
    })
  })

  test('adds up per model, each request once', () => {
    let usage = parseConversationRunUsage(null)

    for (const [model, inputTokens] of [
      ['claude-opus-5-5', 100],
      ['claude-opus-5-5', 50],
      ['claude-opus-5', 7],
    ] as const) {
      const reserved = reserveConversationRequest(usage, RESERVATION)

      usage = settleConversationRequest(
        reserved.usage,
        reserved.index,
        answer(model, { inputTokens, outputTokens: 1, cacheCreationInputTokens: 3 }),
        { turnPosition: null },
      )
    }

    expect(usage.byModel).toEqual({
      'claude-opus-5-5': {
        requests: 2,
        inputTokens: 150,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 6,
        outputTokens: 2,
        webSearchRequests: 0,
      },
      'claude-opus-5': {
        requests: 1,
        inputTokens: 7,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 3,
        outputTokens: 1,
        webSearchRequests: 0,
      },
    })
  })

  test('counts what a model that declined a request used under that model, and nothing more of the request', () => {
    const { usage, index } = reserveConversationRequest(parseConversationRunUsage(null), RESERVATION)
    const served = answer('claude-opus-4-8', { inputTokens: 40, outputTokens: 30 })

    served.usage.iterations = [
      {
        type: 'message',
        model: 'claude-opus-5-5',
        input_tokens: 40,
        cache_read_input_tokens: 900,
        cache_creation_input_tokens: 0,
        output_tokens: 12,
        cache_creation: null,
      },
      {
        type: 'fallback_message',
        model: 'claude-opus-4-8',
        input_tokens: 40,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 30,
        cache_creation: null,
      },
    ]

    const settled = settleConversationRequest(usage, index, served, { turnPosition: null })

    expect(settled.requests[index]).toMatchObject({ model: 'claude-opus-4-8', inputTokens: 40, outputTokens: 30 })
    expect(settled.byModel).toEqual({
      'claude-opus-4-8': {
        requests: 1,
        inputTokens: 40,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        outputTokens: 30,
        webSearchRequests: 0,
      },
      'claude-opus-5-5': {
        requests: 0,
        inputTokens: 40,
        cacheReadInputTokens: 900,
        cacheCreationInputTokens: 0,
        outputTokens: 12,
        webSearchRequests: 0,
      },
    })
  })

  test('counts no declined attempt for a request no model declined, its iterations a search’s loop', () => {
    const { usage, index } = reserveConversationRequest(parseConversationRunUsage(null), RESERVATION)
    const searched = answer('claude-opus-5-5', { inputTokens: 80, outputTokens: 20 })

    searched.usage.iterations = [
      {
        type: 'message',
        model: 'claude-opus-5-5',
        input_tokens: 30,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 5,
        cache_creation: null,
      },
      {
        type: 'message',
        model: null,
        input_tokens: 50,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 15,
        cache_creation: null,
      },
    ]

    const settled = settleConversationRequest(usage, index, searched, { turnPosition: null })

    expect(settled.requests[index]?.declined).toEqual([])
    expect(Object.keys(settled.byModel)).toEqual(['claude-opus-5-5'])
  })

  test('charges a request a worker reserved and never settled at its estimate and the whole output allowed', () => {
    const { usage } = reserveConversationRequest(parseConversationRunUsage(null), RESERVATION)
    const charged = chargeUnsettledRequests(usage)

    expect(charged.requests[0]).toMatchObject({
      model: 'claude-opus-5-5',
      inputTokens: 1200,
      outputTokens: 64000,
      isEstimated: true,
      isSettled: true,
    })
    expect(charged.byModel['claude-opus-5-5']?.outputTokens).toBe(64000)
  })

  test('reads a ledger back whatever order its keys come in, and an empty one from nothing', () => {
    const { usage } = reserveConversationRequest(parseConversationRunUsage(null), RESERVATION)
    const reordered = JSON.parse(JSON.stringify({ byModel: {}, requests: usage.requests }))

    expect(parseConversationRunUsage(reordered).requests).toEqual(usage.requests)
    expect(parseConversationRunUsage({ requests: 'none' })).toEqual({ requests: [], byModel: {} })
  })
})
