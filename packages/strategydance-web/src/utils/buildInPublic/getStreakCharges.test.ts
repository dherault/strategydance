import { describe, expect, it } from 'bun:test'

import getStreakCharges from '~utils/buildInPublic/getStreakCharges'

// 2026-10-04 is a Sunday, and the examples run up to it
const TODAY = '2026-10-04'

describe('getStreakCharges', () => {
  it('holds none without a day', () => {
    expect(getStreakCharges([], TODAY)).toEqual({ count: 0, chargedDates: [], isPending: false })
  })

  it('earns one on each active day, up to two', () => {
    expect(getStreakCharges(['2026-10-04'], TODAY).count).toBe(1)
    expect(getStreakCharges(['2026-10-03', '2026-10-04'], TODAY).count).toBe(2)
    expect(getStreakCharges(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'], TODAY).count).toBe(2)
  })

  it('uses one on a day without an update', () => {
    expect(getStreakCharges(['2026-10-01', '2026-10-02', '2026-10-04'], TODAY)).toEqual({
      count: 2,
      chargedDates: ['2026-10-03'],
      isPending: false,
    })
  })

  it('uses both on two days in a row without one', () => {
    expect(getStreakCharges(['2026-09-30', '2026-10-01', '2026-10-04'], TODAY)).toEqual({
      count: 1,
      chargedDates: ['2026-10-02', '2026-10-03'],
      isPending: false,
    })
  })

  it('keeps nothing through a third day without one', () => {
    expect(getStreakCharges(['2026-09-29', '2026-09-30'], TODAY)).toEqual({
      count: 0,
      chargedDates: ['2026-10-01', '2026-10-02'],
      isPending: false,
    })
  })

  it('earns them again after the streak broke', () => {
    expect(getStreakCharges(['2026-09-25', '2026-09-28', '2026-09-29'], '2026-09-30')).toEqual({
      count: 2,
      chargedDates: ['2026-09-26', '2026-09-30'],
      isPending: true,
    })
  })

  it('counts today as pending while it has no update and a charge is left', () => {
    expect(getStreakCharges(['2026-10-03'], TODAY)).toEqual({
      count: 1,
      chargedDates: ['2026-10-04'],
      isPending: true,
    })
  })

  it('leaves today out once no charge is left', () => {
    expect(getStreakCharges(['2026-10-01'], TODAY)).toEqual({
      count: 0,
      chargedDates: ['2026-10-02'],
      isPending: false,
    })
  })

  it('reads the days in any order, and leaves out a day after today', () => {
    expect(getStreakCharges(['2026-10-05', '2026-10-04', '2026-10-01', '2026-10-02'], TODAY)).toEqual(
      getStreakCharges(['2026-10-01', '2026-10-02', '2026-10-04'], TODAY),
    )
    expect(getStreakCharges(['2026-10-05'], TODAY)).toEqual({ count: 0, chargedDates: [], isPending: false })
  })
})
