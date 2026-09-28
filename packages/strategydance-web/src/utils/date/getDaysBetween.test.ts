import { describe, expect, it } from 'bun:test'

import getDaysBetween from '~utils/date/getDaysBetween'

describe('getDaysBetween', () => {
  it('counts whole days, whichever way', () => {
    expect(getDaysBetween('2026-09-28', '2026-09-28')).toBe(0)
    expect(getDaysBetween('2026-09-27', '2026-09-28')).toBe(1)
    expect(getDaysBetween('2026-09-28', '2026-09-21')).toBe(-7)
    expect(getDaysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })
})
