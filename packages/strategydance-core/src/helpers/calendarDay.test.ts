import { describe, expect, it } from 'bun:test'

import {
  addCalendarDays,
  addCalendarMonths,
  compareDays,
  countCalendarDays,
  countCalendarMonths,
  endOfMonth,
  isCalendarDay,
  startOfMonth,
  startOfQuarter,
} from './calendarDay'

describe('addCalendarDays', () => {
  it('crosses months, years and leap days either way', () => {
    expect(addCalendarDays('2026-10-19', 13)).toBe('2026-11-01')
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addCalendarDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addCalendarDays('2026-10-19', -200)).toBe('2026-04-02')
    expect(addCalendarDays('2026-10-19', 0)).toBe('2026-10-19')
  })

  it('stays on the day whatever the time zone, across a clock change', () => {
    expect(addCalendarDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addCalendarDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addCalendarDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('addCalendarMonths', () => {
  it("clamps to the month's last day", () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addCalendarMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addCalendarMonths('2026-01-31', 2)).toBe('2026-03-31')
    expect(addCalendarMonths('2026-03-31', 1)).toBe('2026-04-30')
    expect(addCalendarMonths('2028-02-29', 12)).toBe('2029-02-28')
  })

  it('crosses years either way', () => {
    expect(addCalendarMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addCalendarMonths('2026-01-15', -1)).toBe('2025-12-15')
    expect(addCalendarMonths('2026-03-31', -13)).toBe('2025-02-28')
    expect(addCalendarMonths('2026-10-19', 24)).toBe('2028-10-19')
  })
})

describe('countCalendarDays', () => {
  it('counts the days between two, negative backwards', () => {
    expect(countCalendarDays('2026-01-01', '2026-12-31')).toBe(364)
    expect(countCalendarDays('2028-01-01', '2028-12-31')).toBe(365)
    expect(countCalendarDays('2026-10-19', '2026-04-02')).toBe(-200)
    expect(countCalendarDays('1999-01-04', '1999-01-04')).toBe(0)
  })
})

describe('countCalendarMonths', () => {
  it("counts months between two days' months, whatever their dates", () => {
    expect(countCalendarMonths('2025-12-31', '2026-01-01')).toBe(1)
    expect(countCalendarMonths('2026-10-19', '2026-10-01')).toBe(0)
    expect(countCalendarMonths('2026-10-19', '2025-02-28')).toBe(-20)
  })
})

describe('startOfMonth, endOfMonth and startOfQuarter', () => {
  it("find the month's and the quarter's bounds", () => {
    expect(startOfMonth('2026-10-19')).toBe('2026-10-01')
    expect(endOfMonth('2026-10-19')).toBe('2026-10-31')
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29')
    expect(endOfMonth('2026-09-01')).toBe('2026-09-30')
    expect(startOfQuarter('2026-01-01')).toBe('2026-01-01')
    expect(startOfQuarter('2026-03-31')).toBe('2026-01-01')
    expect(startOfQuarter('2026-04-01')).toBe('2026-04-01')
    expect(startOfQuarter('2026-10-19')).toBe('2026-10-01')
    expect(startOfQuarter('2026-12-31')).toBe('2026-10-01')
  })
})

describe('compareDays', () => {
  it('sorts days earlier first', () => {
    expect(['2026-10-19', '2025-12-31', '2026-02-01'].sort(compareDays)).toEqual([
      '2025-12-31',
      '2026-02-01',
      '2026-10-19',
    ])
    expect(compareDays('2026-10-19', '2026-10-19')).toBe(0)
  })
})

describe('a day that is not one', () => {
  it('throws rather than roll over', () => {
    for (const day of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-1-1', '19-10-2026', '']) {
      expect(() => addCalendarDays(day, 1)).toThrow(RangeError)
    }
  })
})

describe('isCalendarDay', () => {
  it('holds a day that exists, written YYYY-MM-DD', () => {
    expect(isCalendarDay('2026-10-27')).toBe(true)
    expect(isCalendarDay('2028-02-29')).toBe(true)
  })

  it('refuses a day that is not one', () => {
    for (const day of ['2026-02-29', '2026-13-01', '2026-1-1', '27/10/2026', '2026-10-27T00:00:00Z', '']) {
      expect(isCalendarDay(day)).toBe(false)
    }
  })
})
