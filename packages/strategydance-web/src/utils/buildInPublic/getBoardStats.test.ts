import { describe, expect, it } from 'bun:test'

import { CompanyAspect, TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getBoardStats from '~utils/buildInPublic/getBoardStats'

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
    doneAt: null,
    updatedAt: '2026-10-09T10:00:00Z',
    dependencies: [],
    linkCount: [{ _count: 0 }],
    ...overrides,
  }
}

describe('getBoardStats', () => {
  it('counts the tasks of each column, every column there even when empty', () => {
    const { statusCounts } = getBoardStats([
      makeTask('a', { status: TaskStatus.DONE }),
      makeTask('b', { status: TaskStatus.DONE }),
      makeTask('c', { status: TaskStatus.ONGOING }),
    ])

    expect(statusCounts).toEqual({ BACKLOG: 0, TODO: 0, ONGOING: 1, DONE: 2 })
  })

  it('counts each aspect, the busiest first and ties in their usual order, leaving out those of no task', () => {
    const { aspects } = getBoardStats([
      makeTask('a', { aspects: [CompanyAspect.LEGAL, CompanyAspect.SALES], status: TaskStatus.DONE }),
      makeTask('b', { aspects: [CompanyAspect.LEGAL] }),
      makeTask('c', { aspects: [CompanyAspect.STRATEGY] }),
    ])

    expect(aspects).toEqual([
      { aspect: CompanyAspect.LEGAL, total: 2, done: 1 },
      { aspect: CompanyAspect.STRATEGY, total: 1, done: 0 },
      { aspect: CompanyAspect.SALES, total: 1, done: 1 },
    ])
  })

  it('counts who does what, Strategy Dance among them and nobody left out', () => {
    const { workers } = getBoardStats([
      makeTask('a', { isAssignedToAgent: true, status: TaskStatus.DONE }),
      makeTask('b', { assigneeId: 'sam' }),
      makeTask('c', { assigneeId: 'sam' }),
      makeTask('d'),
    ])

    expect(workers).toEqual([
      { worker: 'member:sam', total: 2, done: 0 },
      { worker: 'agent', total: 1, done: 1 },
    ])
  })
})
