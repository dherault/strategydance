import { describe, expect, it } from 'bun:test'

import getStreak from '~utils/buildInPublic/getStreak'
import getStreakCharges from '~utils/buildInPublic/getStreakCharges'

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

  it('runs through a charged day without counting it', () => {
    const dates = ['2026-10-04', '2026-10-02', '2026-10-01']

    expect(getStreak(dates, '2026-10-04', ['2026-10-03'])).toEqual({ current: 3, best: 3, isLitToday: true })
  })

  it('keeps the streak through a charged yesterday and a pending today', () => {
    const dates = ['2026-10-02', '2026-10-01']

    expect(getStreak(dates, '2026-10-04', ['2026-10-03', '2026-10-04'])).toEqual({
      current: 2,
      best: 2,
      isLitToday: false,
    })
  })

  it('bridges the best run over a charged day', () => {
    const dates = ['2026-09-20', '2026-09-21', '2026-09-23', '2026-09-24', '2026-10-04']

    expect(getStreak(dates, '2026-10-04', ['2026-09-22'])).toEqual({ current: 1, best: 4, isLitToday: true })
  })

  it('breaks once the charges run out', () => {
    const dates = ['2026-09-29', '2026-09-30']
    const { chargedDates } = getStreakCharges(dates, '2026-10-04')

    expect(getStreak(dates, '2026-10-04', chargedDates)).toEqual({ current: 0, best: 2, isLitToday: false })
  })
})
