import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getTasksWaitingOn from '~utils/task/getTasksWaitingOn'

function makeTask(id: string, dependencyIds: string[] = []): Task {
  return {
    id,
    name: id,
    status: TaskStatus.TODO,
    position: 1,
    assigneeId: null,
    isAssignedToAgent: false,
    dueDate: null,
    aspects: [],
    createdById: null,
    createdAt: '2026-10-09T10:00:00Z',
    dependencies: dependencyIds.map(dependencyId => ({ dependencyId })),
    linkCount: [{ _count: dependencyIds.length }],
  }
}

describe('getTasksWaitingOn', () => {
  it('finds the tasks waiting on these, directly and through others', () => {
    // A waits on B, which waits on C; D waits on C; E waits on nothing
    const board = [makeTask('a', ['b']), makeTask('b', ['c']), makeTask('c'), makeTask('d', ['c']), makeTask('e')]

    expect([...getTasksWaitingOn(['c'], board)].sort()).toEqual(['a', 'b', 'd'])
    expect([...getTasksWaitingOn(['b', 'e'], board)]).toEqual(['a'])
    expect(getTasksWaitingOn(['a'], board).size).toBe(0)
  })

  it('ends at a loop the board holds already', () => {
    const board = [makeTask('a', ['b']), makeTask('b', ['c']), makeTask('c', ['a'])]

    expect([...getTasksWaitingOn(['a'], board)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('follows a chain as long as a board holds', () => {
    const board = Array.from({ length: 1000 }, (_, index) => makeTask(`t${index}`, index > 0 ? [`t${index - 1}`] : []))

    expect(getTasksWaitingOn(['t0'], board).size).toBe(999)
  })
})
