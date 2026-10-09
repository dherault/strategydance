import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import compareTasks from '~utils/task/compareTasks'

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
    linkCount: [{ _count: 0 }],
    ...overrides,
  }
}

describe('compareTasks', () => {
  it('orders by position, then by when they were added, then by id', () => {
    const tasks = [
      makeTask('d', { position: 2 }),
      makeTask('c', { position: 1, createdAt: '2026-10-09T11:00:00Z' }),
      makeTask('b', { position: 1 }),
      makeTask('a', { position: 1 }),
    ]

    expect(tasks.sort(compareTasks).map(task => task.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})
