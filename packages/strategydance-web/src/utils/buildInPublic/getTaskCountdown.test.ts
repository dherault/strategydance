import { describe, expect, it } from 'bun:test'

import getTaskCountdown from '~utils/buildInPublic/getTaskCountdown'

const TODAY = '2026-10-14'

describe('getTaskCountdown', () => {
  it('counts down to a due date, says when it is today, and counts the days past it', () => {
    expect(getTaskCountdown('2026-10-20', null, TODAY)).toEqual({ kind: 'shippingIn', days: 6 })
    expect(getTaskCountdown(TODAY, null, TODAY)).toEqual({ kind: 'shippingToday', days: null })
    expect(getTaskCountdown('2026-10-11', null, TODAY)).toEqual({ kind: 'pastDue', days: 3 })
  })

  it('measures a done task from the day it was done, not today', () => {
    expect(getTaskCountdown('2026-10-20', '2026-10-01', TODAY)).toEqual({ kind: 'shippedAhead', days: 19 })
    expect(getTaskCountdown('2026-10-10', '2026-10-10', TODAY)).toEqual({ kind: 'shippedOnTime', days: 4 })
    expect(getTaskCountdown('2026-10-05', '2026-10-09', TODAY)).toEqual({ kind: 'shipped', days: 5 })
  })

  it('says a task done today was done today', () => {
    expect(getTaskCountdown(TODAY, TODAY, TODAY)).toEqual({ kind: 'shippedOnTime', days: null })
    expect(getTaskCountdown('2026-10-01', TODAY, TODAY)).toEqual({ kind: 'shipped', days: null })
  })
})
