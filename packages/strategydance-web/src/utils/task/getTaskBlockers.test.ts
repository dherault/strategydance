import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getTaskBlockers from '~utils/task/getTaskBlockers'

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

describe('getTaskBlockers', () => {
  it('lists what a task waits on that is not done', () => {
    const tasks = [
      makeTask('a', { dependencies: waitsOn('b', 'c', 'gone') }),
      makeTask('b', { status: TaskStatus.DONE }),
      makeTask('c', { status: TaskStatus.ONGOING }),
    ]
    const tasksById = new Map(tasks.map(task => [task.id, task]))

    expect(getTaskBlockers(tasks[0]!, tasksById).map(task => task.id)).toEqual(['c'])
  })
})
