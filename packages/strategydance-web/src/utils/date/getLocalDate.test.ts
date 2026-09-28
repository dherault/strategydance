import { describe, expect, it } from 'bun:test'

import getLocalDate from '~utils/date/getLocalDate'

describe('getLocalDate', () => {
  // 23:30 in UTC on the 28th is already the 29th in Paris, and still the 28th in New York
  const instant = Date.UTC(2026, 8, 28, 23, 30)

  it('reads the day in the zone given', () => {
    expect(getLocalDate(instant, 'UTC')).toBe('2026-09-28')
    expect(getLocalDate(instant, 'Europe/Paris')).toBe('2026-09-29')
    expect(getLocalDate(instant, 'America/New_York')).toBe('2026-09-28')
  })

  it('pads months and days', () => {
    expect(getLocalDate(Date.UTC(2026, 0, 5, 12), 'UTC')).toBe('2026-01-05')
  })

  it('falls back to the system zone for a value that is not one', () => {
    expect(getLocalDate(instant, 'Not/A_Zone')).toBe(getLocalDate(instant))
    expect(getLocalDate(instant, '+05:00')).toBe(getLocalDate(instant))
  })
})
