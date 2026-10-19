import { describe, expect, test } from 'bun:test'

import findSpendFreedAt from './findSpendFreedAt'

const NOW = Date.parse('2026-10-19T12:00:00.000Z')
const HOUR = 60 * 60 * 1000

// A run that may have cost `dollars`, which last spent `hoursAgo` before now
function run(dollars: number, hoursAgo: number) {
  return { costBound: String(dollars * 1_000_000), spentAt: new Date(NOW - hoursAgo * HOUR).toISOString() }
}

describe('findSpendFreedAt', () => {
  test('says now when nothing has to leave', () => {
    expect(findSpendFreedAt([run(10, 3)], 0, NOW)).toBe(NOW)
  })

  test('says when the oldest runs that add up to what has to leave are a day past their last spend', () => {
    const runs = [run(2, 20), run(3, 10), run(5, 2)]

    expect(findSpendFreedAt(runs, 1_000_000, NOW)).toBe(NOW + 4 * HOUR)
    expect(findSpendFreedAt(runs, 4_000_000, NOW)).toBe(NOW + 14 * HOUR)
    expect(findSpendFreedAt(runs, 10_000_000, NOW)).toBe(NOW + 22 * HOUR)
  })

  test('says the last run’s time when the runs read cannot free it, and a day out when there are none', () => {
    expect(findSpendFreedAt([run(2, 20)], 5_000_000, NOW)).toBe(NOW + 4 * HOUR)
    expect(findSpendFreedAt([], 5_000_000, NOW)).toBe(NOW + 24 * HOUR)
  })
})
