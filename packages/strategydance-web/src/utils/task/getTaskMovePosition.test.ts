import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getTaskMovePosition from '~utils/task/getTaskMovePosition'

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

const column = [makeTask('a', { position: 1 }), makeTask('b', { position: 2 }), makeTask('c', { position: 3 })]

describe('getTaskMovePosition', () => {
  it('lands halfway between its new neighbours', () => {
    expect(getTaskMovePosition(column, 'b')).toBe(1.5)
  })

  it('lands before the first, past the last, or in an empty column', () => {
    expect(getTaskMovePosition(column, 'a')).toBe(0)
    expect(getTaskMovePosition(column, null)).toBe(4)
    expect(getTaskMovePosition(column, 'gone')).toBe(4)
    expect(getTaskMovePosition([], null)).toBe(1)
  })

  it('answers null between two tied tasks', () => {
    expect(getTaskMovePosition([makeTask('a', { position: 1 }), makeTask('b', { position: 1 })], 'b')).toBeNull()
  })
})
