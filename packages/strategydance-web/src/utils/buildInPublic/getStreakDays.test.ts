import { describe, expect, it } from 'bun:test'

import getStreakDays from '~utils/buildInPublic/getStreakDays'

describe('getStreakDays', () => {
  it('lays this week out from Monday to Sunday', () => {
    // A Tuesday
    const week = getStreakDays(['2026-09-28', '2026-09-29', '2026-09-26'], '2026-09-29', 1)

    expect(week.map(day => day.date)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
    expect(week.map(day => day.isOn)).toEqual([true, true, false, false, false, false, false])
    expect(week.map(day => day.isToday)).toEqual([false, true, false, false, false, false, false])
    expect(week.map(day => day.isFuture)).toEqual([false, false, true, true, true, true, true])
  })

  it('starts a Sunday week six days before it', () => {
    expect(getStreakDays([], '2026-10-04', 1)[0].date).toBe('2026-09-28')
  })

  it('reaches back as many weeks as asked, the current one last', () => {
    const calendar = getStreakDays(['2026-09-01'], '2026-09-29', 5)

    expect(calendar).toHaveLength(35)
    expect(calendar[0].date).toBe('2026-08-31')
    expect(calendar[1]).toEqual({ date: '2026-09-01', isOn: true, isCharged: false, isToday: false, isFuture: false })
    expect(calendar[34].date).toBe('2026-10-04')
  })

  it('flags the days a charge kept, and only those that were not active nor still to come', () => {
    // A Tuesday
    const week = getStreakDays(['2026-09-28'], '2026-09-30', 1, [
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ])

    expect(week.map(day => day.isCharged)).toEqual([false, true, true, false, false, false, false])
  })
})
