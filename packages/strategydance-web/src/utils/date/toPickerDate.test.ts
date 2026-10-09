import { describe, expect, it } from 'bun:test'

import fromPickerDate from '~utils/date/fromPickerDate'
import toPickerDate from '~utils/date/toPickerDate'

describe('toPickerDate', () => {
  it('shows a day on its local midnight', () => {
    const date = toPickerDate('2026-03-29')

    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 2, 29, 0])
  })

  it('reads back as the same day, whatever the zone', () => {
    for (const day of ['2026-01-01', '2026-03-29', '2026-10-25', '2026-12-31']) {
      expect(fromPickerDate(toPickerDate(day))).toBe(day)
    }
  })
})
