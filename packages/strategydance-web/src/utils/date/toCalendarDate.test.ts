import { describe, expect, it } from 'bun:test'

import toCalendarDate from '~utils/date/toCalendarDate'

describe('toCalendarDate', () => {
  it('starts the day in UTC', () => {
    expect(toCalendarDate('2026-09-28').toISOString()).toBe('2026-09-28T00:00:00.000Z')
  })
})
