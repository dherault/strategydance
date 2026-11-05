import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getTaskColumn from '~utils/task/getTaskColumn'

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    name: id,
    status: TaskStatus.DONE,
    position: 1,
    assigneeId: null,
    isAssignedToAgent: false,
    dueDate: null,
    aspects: [],
    createdById: null,
    createdAt: '2026-10-09T10:00:00Z',
    doneAt: null,
    dependencies: [],
    linkCount: [{ _count: 0 }],
    ...overrides,
  }
}

function toIds(tasks: readonly Task[]) {
  return tasks.map(task => task.id)
}

describe('getTaskColumn', () => {
  it('keeps a column other than Done in position order', () => {
    const tasks = [
      makeTask('c', { status: TaskStatus.ONGOING, position: 3, doneAt: '2026-10-12T10:00:00Z' }),
      makeTask('a', { status: TaskStatus.ONGOING, position: 1 }),
      makeTask('done', { position: 0 }),
      makeTask('b', { status: TaskStatus.ONGOING, position: 2, doneAt: '2026-10-13T10:00:00Z' }),
    ]

    expect(toIds(getTaskColumn(tasks, TaskStatus.ONGOING))).toEqual(['a', 'b', 'c'])
  })

  it('puts the last done on top of Done, whatever the positions', () => {
    const tasks = [
      makeTask('first', { position: 1, doneAt: '2026-10-10T10:00:00Z' }),
      makeTask('last', { position: 3, doneAt: '2026-10-12T10:00:00Z' }),
      makeTask('second', { position: 2, doneAt: '2026-10-11T10:00:00Z' }),
      makeTask('todo', { status: TaskStatus.TODO, position: 0, doneAt: '2026-10-13T10:00:00Z' }),
    ]

    expect(toIds(getTaskColumn(tasks, TaskStatus.DONE))).toEqual(['last', 'second', 'first'])
  })

  it('dates a done task nobody stamped by when it was added', () => {
    const tasks = [
      makeTask('stamped', { position: 1, doneAt: '2026-10-11T10:00:00Z' }),
      makeTask('created-later', { position: 2, createdAt: '2026-10-12T10:00:00Z' }),
      makeTask('created-earlier', { position: 3, createdAt: '2026-10-10T10:00:00Z' }),
    ]

    expect(toIds(getTaskColumn(tasks, TaskStatus.DONE))).toEqual(['created-later', 'stamped', 'created-earlier'])
  })

  it('compares instants written with any number of digits', () => {
    const tasks = [
      makeTask('earlier', { doneAt: '2026-10-10T10:00:00.123Z' }),
      makeTask('later', { doneAt: '2026-10-10T10:00:00.124567Z' }),
    ]

    expect(toIds(getTaskColumn(tasks, TaskStatus.DONE))).toEqual(['later', 'earlier'])
  })

  it('falls back to the positions for two done at once', () => {
    const tasks = [
      makeTask('b', { position: 2, doneAt: '2026-10-10T10:00:00Z' }),
      makeTask('a', { position: 1, doneAt: '2026-10-10T10:00:00Z' }),
    ]

    expect(toIds(getTaskColumn(tasks, TaskStatus.DONE))).toEqual(['a', 'b'])
  })
})
