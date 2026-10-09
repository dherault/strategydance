import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getTaskRestoreLoops from '~utils/task/getTaskRestoreLoops'

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

describe('getTaskRestoreLoops', () => {
  it('finds the task that, linked again, would close a loop made while one was gone', () => {
    // A waited on B, which waited on C. B is gone, and C was made to wait on A meanwhile
    const snapshot = { task: makeTask('b', ['c']), description: '', dependentIds: ['a'] }
    const board = [makeTask('a'), makeTask('c', ['a'])]

    expect(getTaskRestoreLoops(snapshot, board)).toEqual(['a'])
  })

  it('finds none when the links made meanwhile lead elsewhere', () => {
    const snapshot = { task: makeTask('b', ['c']), description: '', dependentIds: ['a'] }
    const board = [makeTask('a'), makeTask('c', ['d']), makeTask('d')]

    expect(getTaskRestoreLoops(snapshot, board)).toEqual([])
  })

  it('finds a task the deleted one both waited on and blocked', () => {
    const snapshot = { task: makeTask('b', ['a']), description: '', dependentIds: ['a'] }

    expect(getTaskRestoreLoops(snapshot, [makeTask('a')])).toEqual(['a'])
  })
})
