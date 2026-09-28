import { describe, expect, it } from 'bun:test'

import addDays from '~utils/date/addDays'

describe('addDays', () => {
  it('crosses months, years and leap days', () => {
    expect(addDays('2026-09-28', 3)).toBe('2026-10-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-09-28', 0)).toBe('2026-09-28')
  })
})
