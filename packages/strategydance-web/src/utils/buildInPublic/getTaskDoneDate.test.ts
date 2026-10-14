import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import getTaskDoneDate from '~utils/buildInPublic/getTaskDoneDate'

describe('getTaskDoneDate', () => {
  it('dates a done task by when it was stamped done, in the time zone given', () => {
    const task = { status: TaskStatus.DONE, doneAt: '2026-10-13T23:30:00Z', createdAt: '2026-10-01T12:00:00Z' }

    expect(getTaskDoneDate(task, 'UTC')).toBe('2026-10-13')
    expect(getTaskDoneDate(task, 'Europe/Helsinki')).toBe('2026-10-14')
  })

  it('dates a done task nobody stamped by the day it was added', () => {
    expect(getTaskDoneDate({ status: TaskStatus.DONE, doneAt: null, createdAt: '2026-10-02T09:00:00Z' }, 'UTC')).toBe(
      '2026-10-02',
    )
  })

  it('dates no task that is not done, whatever it was stamped', () => {
    expect(
      getTaskDoneDate({ status: TaskStatus.TODO, doneAt: '2026-10-02T09:00:00Z', createdAt: '2026-10-01T09:00:00Z' }),
    ).toBeNull()
  })
})
