import { describe, expect, mock, test } from 'bun:test'

import type { ConversationRequestUsage } from '~domain/conversations/conversationRunUsage'

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { default: summarizeConversationUsage } = await import('./summarizeConversationUsage')

const MODEL = 'claude-opus-5-5'

// A request as a ledger keeps it, settled, Opus 5.5 at $4 a million input and $20 output
function request(values: Partial<ConversationRequestUsage> = {}): ConversationRequestUsage {
  return {
    model: MODEL,
    stopReason: 'end_turn',
    inputTokens: 1_000_000,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: 0,
    webSearchRequests: 0,
    configTokens: 0,
    inputEndPosition: 0,
    turnPosition: 0,
    estimatedInputTokens: 1_000_000,
    isEstimated: false,
    isSettled: true,
    ...values,
  }
}

type RunValues = {
  id?: string
  number?: number
  trigger?: string
  requests?: ConversationRequestUsage[]
  createdAt?: string
  endedAt?: string | null
  conversationId?: string
  userId?: string
  organizationId?: string
  parentId?: string | null
}

function run({
  id = crypto.randomUUID(),
  number = 0,
  trigger = 'MESSAGE',
  requests = [request()],
  createdAt = '2026-10-18T09:00:00.000Z',
  endedAt = '2026-10-18T09:01:00.000Z',
  conversationId = crypto.randomUUID(),
  userId = 'david',
  organizationId = 'strategy-dance',
  parentId = null,
}: RunValues = {}) {
  return {
    id,
    number,
    trigger,
    usage: { requests },
    createdAt,
    endedAt,
    conversation: {
      id: conversationId,
      userId,
      organizationId,
      parentId,
      user: { email: `${userId}@example.com` },
      organization: { name: organizationId, slug: `${organizationId}-ab12` },
    },
  }
}

describe('summarizeConversationUsage', () => {
  test('sums the runs by organization and by account, the subagents’ apart and the tagging among them', () => {
    const summary = summarizeConversationUsage([
      run({ requests: [request(), request({ purpose: 'tagging', inputTokens: 250_000 })] }),
      run({ parentId: 'parent', requests: [request({ inputTokens: 500_000 })] }),
      run({ userId: 'teammate', requests: [request({ outputTokens: 100_000 })] }),
      run({ organizationId: 'side-project', requests: [request({ inputTokens: 250_000 })] }),
    ])

    expect(summary.total).toEqual({
      runs: 3,
      subagentRuns: 1,
      microdollars: 5_000_000 + 6_000_000 + 1_000_000,
      subagentMicrodollars: 2_000_000,
      taggingMicrodollars: 1_000_000,
    })
    expect(
      summary.organizations.map(({ organizationId, microdollars, subagentMicrodollars }) => [
        organizationId,
        microdollars,
        subagentMicrodollars,
      ]),
    ).toEqual([
      ['strategy-dance', 11_000_000, 2_000_000],
      ['side-project', 1_000_000, 0],
    ])
    expect(summary.accounts.map(({ email, runs, subagentRuns }) => [email, runs, subagentRuns])).toEqual([
      ['david@example.com', 2, 1],
      ['teammate@example.com', 1, 0],
    ])
    expect(summary.byModel[MODEL]).toMatchObject({ requests: 5, inputTokens: 3_000_000, outputTokens: 100_000 })
  })

  test('charges a request never settled at its estimate, as the credits count it', () => {
    const summary = summarizeConversationUsage([
      run({ requests: [request({ isSettled: false, model: null, inputTokens: 0, estimatedInputTokens: 100_000 })] }),
    ])

    // Its measured input, and the whole 64000 tokens it was allowed to write
    expect(summary.total.microdollars).toBe(100_000 * 4 + 64_000 * 20)
  })

  test('lists each request billed past its reservation, with what each of its searches brought back', () => {
    const past = request({
      inputTokens: 2_000,
      cacheReadInputTokens: 30_000,
      cacheCreationInputTokens: 10_000,
      estimatedInputTokens: 10_000,
      webSearchRequests: 2,
      worstCaseMicrodollars: 100,
    })
    const summary = summarizeConversationUsage([
      run({
        id: 'past',
        requests: [
          past,
          request({ worstCaseMicrodollars: 10_000_000 }),
          request({ isEstimated: true, worstCaseMicrodollars: 1 }),
        ],
      }),
    ])

    expect(summary.pastReservation).toEqual([
      {
        runId: 'past',
        conversationId: expect.any(String),
        model: MODEL,
        webSearchRequests: 2,
        billedMicrodollars: 2_000 * 4 + 30_000 * 0.2 + 10_000 * 5 + 2 * 10_000,
        reservedMicrodollars: 100,
        // 42000 read, three readings of 10000 among them
        searchResultTokensPerSearch: 6_000,
      },
    ])
  })

  test('buckets the pauses before members’ messages by the cache’s lifetimes, with what each wrote to it', () => {
    const conversationId = crypto.randomUUID()
    const runs = [
      run({ conversationId, number: 0, endedAt: '2026-10-18T09:00:30.000Z' }),
      // Two minutes after the run before ended, then twenty, then two hours
      run({
        conversationId,
        number: 1,
        createdAt: '2026-10-18T09:02:30.000Z',
        endedAt: '2026-10-18T09:03:00.000Z',
        requests: [request({ cacheReadInputTokens: 9_000, cacheCreationInputTokens: 100 })],
      }),
      run({
        conversationId,
        number: 2,
        createdAt: '2026-10-18T09:23:00.000Z',
        endedAt: '2026-10-18T09:24:00.000Z',
        requests: [request({ cacheCreationInputTokens: 9_100 })],
      }),
      run({ conversationId, number: 3, trigger: 'ANSWER', createdAt: '2026-10-18T11:30:00.000Z' }),
      run({ conversationId, number: 5, createdAt: '2026-10-18T14:00:00.000Z' }),
    ]

    expect(summarizeConversationUsage(runs).pauses).toEqual([
      { bucket: 'underFiveMinutes', messages: 1, cacheCreationInputTokens: 100, cacheReadInputTokens: 9_000 },
      { bucket: 'underAnHour', messages: 1, cacheCreationInputTokens: 9_100, cacheReadInputTokens: 0 },
      // The answer is no message, and the last run's previous one was not read
      { bucket: 'longer', messages: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    ])
  })
})
