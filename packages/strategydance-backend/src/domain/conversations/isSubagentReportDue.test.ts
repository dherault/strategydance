import { describe, expect, test } from 'bun:test'

import { MAX_CONVERSATION_RUN_ENTRIES } from 'strategydance-core'

import type { ConversationRequestUsage, ConversationRunUsage } from '~domain/conversations/conversationRunUsage'

import isSubagentReportDue from './isSubagentReportDue'

const LIMITS = {
  maxRequests: 25,
  maxDurationMs: 10 * 60 * 1000,
  streamDeadlineMs: 14 * 60 * 1000,
  maxCostMicrodollars: 10_000_000,
  dailySpendCeilings: null,
}

function request(values: Partial<ConversationRequestUsage> = {}): ConversationRequestUsage {
  return {
    model: 'claude-opus-5-5',
    stopReason: 'tool_use',
    inputTokens: 1000,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: 50,
    webSearchRequests: 0,
    configTokens: 500,
    inputEndPosition: 0,
    turnPosition: 1,
    estimatedInputTokens: 1000,
    isEstimated: false,
    isSettled: true,
    ...values,
  }
}

// A ledger that spent so many dollars, $1 being 50000 output tokens of Opus 5.5, then sent one small request
function spent(dollars: number): ConversationRunUsage {
  return { requests: [request({ outputTokens: dollars * 50_000 }), request()], byModel: {} }
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

const BASE = {
  usage: spent(0),
  limits: LIMITS,
  startedAt: minutesAgo(1),
  entryCount: 10,
  resultsLength: 200,
  model: 'claude-opus-5-5',
}

describe('isSubagentReportDue', () => {
  test('is not due while every budget has room', () => {
    expect(isSubagentReportDue(BASE)).toBe(false)
  })

  test('is due from its 24th request', () => {
    const requests = (count: number) => ({ requests: Array.from({ length: count }, () => request()), byModel: {} })

    expect(isSubagentReportDue({ ...BASE, usage: requests(23) })).toBe(false)
    expect(isSubagentReportDue({ ...BASE, usage: requests(24) })).toBe(true)
    expect(isSubagentReportDue({ ...BASE, usage: requests(25) })).toBe(true)
  })

  test('is due under two minutes before its ten', () => {
    expect(isSubagentReportDue({ ...BASE, startedAt: minutesAgo(7.9) })).toBe(false)
    expect(isSubagentReportDue({ ...BASE, startedAt: minutesAgo(8) })).toBe(true)
    expect(isSubagentReportDue({ ...BASE, startedAt: minutesAgo(11) })).toBe(true)
  })

  test('is due within five of its 100 entries', () => {
    expect(isSubagentReportDue({ ...BASE, entryCount: MAX_CONVERSATION_RUN_ENTRIES - 6 })).toBe(false)
    expect(isSubagentReportDue({ ...BASE, entryCount: MAX_CONVERSATION_RUN_ENTRIES - 5 })).toBe(true)
  })

  /*
    A small request of Opus 5.5 costs some $1.74 at worst, and $3.90 with its fallback: with $4 spent
    the next is reserved with its fallback and leaves $2.36, room for another; with $4.5 it leaves
    $1.86, which is none
  */
  test('is due once the next request, reserved at its worst case, would leave no room for another', () => {
    expect(isSubagentReportDue({ ...BASE, usage: spent(4) })).toBe(false)
    expect(isSubagentReportDue({ ...BASE, usage: spent(4.5) })).toBe(true)
  })

  test('reckons the next request with the results it sends', () => {
    expect(isSubagentReportDue({ ...BASE, usage: spent(3) })).toBe(false)
    // Some 100000 tokens of results make the next request dear enough that $3 leaves no room
    expect(isSubagentReportDue({ ...BASE, usage: spent(3), resultsLength: 300_000 })).toBe(true)
  })

  test('reckons the next request without the last when the run has sent none', () => {
    expect(isSubagentReportDue({ ...BASE, usage: { requests: [], byModel: {} } })).toBe(false)
  })
})
