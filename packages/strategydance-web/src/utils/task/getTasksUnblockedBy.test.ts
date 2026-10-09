import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getTasksUnblockedBy from '~utils/task/getTasksUnblockedBy'

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
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
    dependencies: [],
    ...overrides,
  }
}

function waitsOn(...ids: string[]) {
  return ids.map(dependencyId => ({ dependencyId }))
}

describe('getTasksUnblockedBy', () => {
  it('frees the tasks waiting on nothing else unfinished', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { dependencies: waitsOn('a') }),
      makeTask('c', { dependencies: waitsOn('a', 'd') }),
      makeTask('d'),
      makeTask('e', { dependencies: waitsOn('a'), status: TaskStatus.DONE }),
      makeTask('f', { dependencies: waitsOn('a', 'g') }),
      makeTask('g', { status: TaskStatus.DONE }),
    ]

    expect(getTasksUnblockedBy('a', tasks).map(task => task.id)).toEqual(['b', 'f'])
  })
})
