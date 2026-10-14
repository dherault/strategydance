import { describe, expect, it } from 'bun:test'

import getTaskDays from '~utils/buildInPublic/getTaskDays'

describe('getTaskDays', () => {
  it('counts the days a task has been on the board', () => {
    expect(getTaskDays('2026-10-01', null, '2026-10-14')).toBe(13)
  })

  it('counts the days a done task took, however long ago it was done', () => {
    expect(getTaskDays('2026-09-01', '2026-09-08', '2026-10-14')).toBe(7)
  })

  it('counts a task added today, or added and done the same day, as one day', () => {
    expect(getTaskDays('2026-10-14', null, '2026-10-14')).toBe(1)
    expect(getTaskDays('2026-10-02', '2026-10-02', '2026-10-14')).toBe(1)
  })
})
