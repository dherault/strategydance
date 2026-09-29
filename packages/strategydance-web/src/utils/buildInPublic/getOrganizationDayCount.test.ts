import { describe, expect, it } from 'bun:test'

import getOrganizationDayCount from '~utils/buildInPublic/getOrganizationDayCount'

// Noon on a day in the zone the tests run in, which is on that day there whatever the zone
function localNoon(month: number, day: number) {
  return new Date(2026, month - 1, day, 12).toISOString()
}

describe('getOrganizationDayCount', () => {
  it('counts the day it was made as day 1', () => {
    expect(getOrganizationDayCount(localNoon(9, 29), '2026-09-29')).toBe(1)
    expect(getOrganizationDayCount(localNoon(9, 20), '2026-09-29')).toBe(10)
  })

  it('never counts below day 1', () => {
    expect(getOrganizationDayCount(localNoon(9, 30), '2026-09-29')).toBe(1)
  })
})
