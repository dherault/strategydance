import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getTaskLoopingDependents from '~utils/task/getTaskLoopingDependents'

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
  }
}

describe('getTaskLoopingDependents', () => {
  it('finds the task waiting on one that its links lead back to', () => {
    // A waits on B, which waits on C, which waits on A
    const board = [makeTask('a', ['b']), makeTask('b', ['c']), makeTask('c', ['a'])]

    expect(getTaskLoopingDependents('b', board)).toEqual(['a'])
  })

  it('finds none outside a loop', () => {
    const board = [makeTask('a', ['b']), makeTask('b', ['c']), makeTask('c'), makeTask('d', ['b'])]

    expect(getTaskLoopingDependents('b', board)).toEqual([])
  })
})
