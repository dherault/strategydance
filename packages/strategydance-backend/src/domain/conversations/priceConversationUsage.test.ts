import { describe, expect, mock, test } from 'bun:test'

import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'

const warn = mock((_message: string) => {})

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn, error: () => {} } }))

const { CLAUDE_FALLBACK_MODELS, CLAUDE_MODEL_PRICES, CONVERSATION_MODEL, CONVERSATION_REQUEST_SETTINGS } =
  await import('~domain/agent/conversationRequestSettings')
const { SUBAGENT_REQUEST_SETTINGS } = await import('~domain/agent/subagentRequestSettings')
const { chargeUnsettledRequests, parseConversationRunUsage, reserveConversationRequest, settleConversationRequest } =
  await import('./conversationRunUsage')
const {
  default: priceConversationUsage,
  priceConversationRequest,
  priceConversationUsageBound,
  priceRequestWorstCase,
  readModelPrice,
} = await import('./priceConversationUsage')

// A message answering a request, with the usage given
function message(model: string, usage: Partial<BetaMessage['usage']>, iterations: unknown[] | null = null) {
  return {
    model,
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      server_tool_use: null,
      iterations,
      ...usage,
    },
  } as unknown as BetaMessage
}

function settled(answer: BetaMessage) {
  const reserved = reserveConversationRequest(parseConversationRunUsage(null), {
    estimatedInputTokens: 1000,
    configTokens: 0,
    inputEndPosition: 0,
  })

  return settleConversationRequest(reserved.usage, reserved.index, answer, { turnPosition: 1 })
}

describe('CLAUDE_MODEL_PRICES', () => {
  test('prices every model a request can name, and every model the API may fall back to from one', () => {
    const named = [
      CONVERSATION_MODEL,
      CONVERSATION_REQUEST_SETTINGS.model,
      SUBAGENT_REQUEST_SETTINGS.model,
      // What `measure:subagents` runs a subagent on besides
      'claude-sonnet-5-5',
      // The fallback the tests' declined attempts name
      'claude-opus-4-8',
    ]
    const fallbacks = named.flatMap(model => CLAUDE_FALLBACK_MODELS[model] ?? [])

    for (const model of [...named, ...fallbacks]) expect(CLAUDE_MODEL_PRICES[model]).toBeDefined()
    for (const model of named.filter(model => model.endsWith('-5-5')))
      expect(CLAUDE_FALLBACK_MODELS[model]).toBeDefined()
  })
})

describe('priceConversationUsage', () => {
  test('prices a request at list prices: input, cache reads and writes, output, and its searches', () => {
    const usage = settled(
      message(CONVERSATION_MODEL, {
        input_tokens: 1000,
        cache_read_input_tokens: 10_000,
        cache_creation_input_tokens: 2000,
        output_tokens: 500,
        server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 },
      } as Partial<BetaMessage['usage']>),
    )

    // 4000 + 2000 + 10000 + 10000 microdollars of tokens, and two searches at a cent
    expect(priceConversationUsage(usage)).toBeCloseTo(4000 + 2000 + 10_000 + 10_000 + 20_000)
  })

  test('prices the attempt a model declined at that model’s prices, beside the fallback that answered', () => {
    const usage = settled(
      message('claude-opus-5', { input_tokens: 1000, output_tokens: 100 }, [
        {
          type: 'message',
          model: CONVERSATION_MODEL,
          input_tokens: 1000,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          output_tokens: 50,
        },
        { type: 'message', model: 'claude-opus-5', input_tokens: 1000, output_tokens: 100 },
      ]),
    )

    // Opus 5's 5000 + 2500, and Opus 5.5's declined 4000 + 1000
    expect(priceConversationRequest(usage.requests[0]!)).toBeCloseTo(7500 + 5000)
  })

  test('prices a request reserved and never settled as a worker taking over charges it', () => {
    const reserved = reserveConversationRequest(parseConversationRunUsage(null), {
      estimatedInputTokens: 10_000,
      configTokens: 0,
      inputEndPosition: 0,
    })

    // Its input uncached and its whole output, 64000 tokens
    expect(priceConversationUsage(reserved.usage)).toBeCloseTo(10_000 * 4 + 64_000 * 20)
  })

  test('prices a model the table lacks as the dearest, never at nothing, and logs it', () => {
    warn.mockClear()

    expect(readModelPrice('claude-unknown-9')).toEqual({ input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('priceRequestWorstCase', () => {
  test('prices an attempt at its input written to the cache, its whole output, and five searches each reading it again', () => {
    const { single, withFallback } = priceRequestWorstCase({
      model: 'claude-opus-5-5',
      inputTokens: 700_000,
      maxTokens: 64_000,
      maxSearches: 5,
    })

    // $3.50 of input, $1.28 of output, and each search $0.14 of cache reads, $0.08 for its allowance
    // of 16000 tokens and its own cent
    expect(single).toBeCloseTo(3_500_000 + 1_280_000 + 5 * (140_000 + 80_000 + 10_000))
    // Opus 5, the dearest fallback: $4.375, $1.60, and each search $0.35, $0.10 and a cent
    expect(withFallback - single).toBeCloseTo(4_375_000 + 1_600_000 + 5 * (350_000 + 100_000 + 10_000))
  })

  test('prices a request without searches, as tagging is, at its input and output alone', () => {
    expect(
      priceRequestWorstCase({ model: 'claude-opus-5-5', inputTokens: 1000, maxTokens: 8000, maxSearches: 0 }).single,
    ).toBeCloseTo(5000 + 160_000)
  })
})

describe('priceConversationUsageBound', () => {
  const base = {
    stopReason: null,
    inputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: 0,
    webSearchRequests: 0,
    configTokens: 0,
    inputEndPosition: 0,
    turnPosition: null,
    estimatedInputTokens: 1000,
  }

  test('counts a request its answer settled at what it used, and any other at its worst case', () => {
    const usage = parseConversationRunUsage({
      requests: [
        {
          ...base,
          model: 'claude-opus-5-5',
          outputTokens: 1000,
          isEstimated: false,
          isSettled: true,
          worstCaseMicrodollars: 9e6,
        },
        { ...base, model: null, isEstimated: false, isSettled: false, worstCaseMicrodollars: 3e6 },
        {
          ...base,
          model: 'claude-opus-5-5',
          outputTokens: 10,
          isEstimated: true,
          isSettled: true,
          worstCaseMicrodollars: 2e6,
        },
      ],
    })

    expect(priceConversationUsageBound(usage)).toBeCloseTo(20_000 + 3e6 + 2e6)
    // A worker taking the run over charges the second at its estimate, which the bound leaves alone
    expect(priceConversationUsageBound(chargeUnsettledRequests(usage))).toBeCloseTo(20_000 + 3e6 + 2e6)
  })

  test('counts a request reserved before the limit, with no worst case, at its estimate', () => {
    const usage = parseConversationRunUsage({
      requests: [{ ...base, model: null, isEstimated: false, isSettled: false }],
    })

    expect(priceConversationUsageBound(usage)).toBeCloseTo(1000 * 4 + 64_000 * 20)
  })
})
