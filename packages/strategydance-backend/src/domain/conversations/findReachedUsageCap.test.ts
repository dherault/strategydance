import { describe, expect, test } from 'bun:test'

import type { GetCappedStartsData } from 'strategydance-database/backend'

import findReachedUsageCap from './findReachedUsageCap'

const NOW = Date.parse('2026-10-18T12:00:00.000Z')

const HOUR = 60 * 60 * 1000

// `count` starts, newest first, the newest `newestHoursAgo` old and each older one `spacing` hours
// before it
function starts(count: number, newestHoursAgo = 0, spacing = 0.1) {
  return Array.from({ length: count }, (_, index) => ({
    createdAt: new Date(NOW - (newestHoursAgo + index * spacing) * HOUR).toISOString(),
  }))
}

function read(overrides: Partial<GetCappedStartsData> = {}): GetCappedStartsData {
  return {
    memberConversations: [],
    accountConversations: [],
    organizationConversations: [],
    memberRuns: [],
    accountRuns: [],
    organizationRuns: [],
    memberSubagents: [],
    accountSubagents: [],
    ...overrides,
  }
}

describe('findReachedUsageCap', () => {
  test('finds nothing below each cap, and each cap at its value', () => {
    expect(findReachedUsageCap(read({ memberRuns: starts(99) }), ['runs'], { now: NOW })).toBeNull()
    expect(findReachedUsageCap(read({ memberRuns: starts(100) }), ['runs'], { now: NOW })).toMatchObject({
      kind: 'runs',
      scope: 'member',
      max: 100,
    })
    expect(findReachedUsageCap(read({ accountRuns: starts(199) }), ['runs'], { now: NOW })).toBeNull()
    expect(findReachedUsageCap(read({ accountRuns: starts(200) }), ['runs'], { now: NOW })).toMatchObject({
      scope: 'account',
      max: 200,
    })
    expect(findReachedUsageCap(read({ organizationRuns: starts(499) }), ['runs'], { now: NOW })).toBeNull()
    expect(findReachedUsageCap(read({ organizationRuns: starts(500) }), ['runs'], { now: NOW })).toMatchObject({
      scope: 'organization',
      max: 500,
    })
    expect(
      findReachedUsageCap(read({ memberConversations: starts(20) }), ['conversations'], { now: NOW }),
    ).toMatchObject({ kind: 'conversations', scope: 'member', max: 20 })
    expect(findReachedUsageCap(read({ accountSubagents: starts(60) }), ['subagents'], { now: NOW })).toMatchObject({
      kind: 'subagents',
      scope: 'account',
      max: 60,
    })
  })

  test('reads only the kinds asked for', () => {
    expect(findReachedUsageCap(read({ memberConversations: starts(20) }), ['runs'], { now: NOW })).toBeNull()
  })

  test('lets what finishes work under way pass a cap, up to one and a half times it', () => {
    expect(findReachedUsageCap(read({ memberRuns: starts(149) }), ['runs'], { isFinishing: true, now: NOW })).toBeNull()
    expect(
      findReachedUsageCap(read({ memberRuns: starts(150) }), ['runs'], { isFinishing: true, now: NOW }),
    ).toMatchObject({ scope: 'member', max: 150 })
  })

  test('says a cap has room once the oldest of the newest starts, as many as the cap, is 24 hours old, a count past its cap included', () => {
    // 120 starts, past the 100, the newest an hour old: the hundredth newest is 10.9 hours old
    const reached = findReachedUsageCap(read({ memberRuns: starts(120, 1) }), ['runs'], { now: NOW })

    expect(reached?.retryAfterMs).toBe((24 - 10.9) * HOUR)
  })

  test('answers, of several caps reached, the one that has room last', () => {
    // The member's hundredth newest run is 10.9 hours old, the organization's five hundredth 6.99
    const member = starts(100, 1)
    const organization = starts(500, 2, 0.01)
    const reached = findReachedUsageCap(read({ memberRuns: member, organizationRuns: organization }), ['runs'], {
      now: NOW,
    })

    expect(reached?.scope).toBe('organization')
    expect(reached?.retryAfterMs).toBeCloseTo((24 - 6.99) * HOUR, -3)
  })
})
