import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/backend'

import { TASK_STATUSES } from '~constants'

import compareTaskPlaces, { type TaskPlace } from './compareTaskPlaces'

function place(fields: Partial<TaskPlace>): TaskPlace {
  return { status: 'TODO', position: 1, createdAt: '2026-10-10T10:00:00.000000Z', id: '0'.repeat(32), ...fields }
}

describe('TASK_STATUSES', () => {
  it("lists each of the schema's statuses once, as the board's columns", () => {
    expect([...TASK_STATUSES].sort()).toEqual(Object.values(TaskStatus).sort())
    expect(new Set(TASK_STATUSES).size).toBe(TASK_STATUSES.length)
  })
})

describe('compareTaskPlaces', () => {
  it('orders column by column, then by position', () => {
    const places = [
      place({ status: 'DONE', position: 0 }),
      place({ status: 'TODO', position: 2 }),
      place({ status: 'BACKLOG', position: 9 }),
      place({ status: 'TODO', position: 1.5 }),
    ]

    expect(places.sort(compareTaskPlaces).map(({ status, position }) => `${status} ${position}`)).toEqual([
      'BACKLOG 9',
      'TODO 1.5',
      'TODO 2',
      'DONE 0',
    ])
  })

  it('breaks a tie by when a task was added, to the microsecond however it is written, then by id', () => {
    const earlier = place({ createdAt: '2026-10-10T10:00:00.87Z', id: 'b'.repeat(32) })
    const later = place({ createdAt: '2026-10-10T10:00:00.870168Z', id: 'a'.repeat(32) })
    const sameInstant = place({ createdAt: '2026-10-10T10:00:00.870168Z', id: 'c'.repeat(32) })

    expect([sameInstant, later, earlier].sort(compareTaskPlaces)).toEqual([earlier, later, sameInstant])
  })

  it('compares ids as Postgres orders a UUID, written with hyphens or without', () => {
    const dashed = place({ id: '00000000-0000-0000-0000-00000000000b' })
    const dashless = place({ id: '0000000000000000000000000000000a' })

    expect([dashed, dashless].sort(compareTaskPlaces)).toEqual([dashless, dashed])
  })
})
