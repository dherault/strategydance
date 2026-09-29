import { describe, expect, it } from 'bun:test'

import getStreak from '~utils/buildInPublic/getStreak'

describe('getStreak', () => {
  it('counts nothing without a day', () => {
    expect(getStreak([], '2026-09-29')).toEqual({ current: 0, best: 0, isLitToday: false })
  })

  it('runs back from today once today counts', () => {
    expect(getStreak(['2026-09-29', '2026-09-28', '2026-09-27', '2026-09-25'], '2026-09-29')).toEqual({
      current: 3,
      best: 3,
      isLitToday: true,
    })
  })

  it('keeps the streak through a today that does not count yet', () => {
    expect(getStreak(['2026-09-28', '2026-09-27'], '2026-09-29')).toEqual({ current: 2, best: 2, isLitToday: false })
  })

  it('breaks it once a whole day went by', () => {
    expect(getStreak(['2026-09-27', '2026-09-26'], '2026-09-29').current).toBe(0)
  })

  it('keeps the best run, across a month and in any order', () => {
    const dates = ['2026-10-02', '2026-09-30', '2026-10-01', '2026-09-29', '2026-10-05']

    expect(getStreak(dates, '2026-10-05')).toEqual({ current: 1, best: 4, isLitToday: true })
  })

  it('leaves out a day after today', () => {
    expect(getStreak(['2026-09-30', '2026-09-29'], '2026-09-29')).toEqual({ current: 1, best: 1, isLitToday: true })
  })
})
