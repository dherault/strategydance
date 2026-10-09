import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getTaskDependencyOptions from '~utils/task/getTaskDependencyOptions'

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

// a waits on b, which waits on c; d stands apart
const tasks = [
  makeTask('a', { dependencies: waitsOn('b') }),
  makeTask('b', { dependencies: waitsOn('c') }),
  makeTask('c'),
  makeTask('d'),
]

function ids(list: Task[]) {
  return list.map(task => task.id)
}

describe('getTaskDependencyOptions', () => {
  it('never offers what would close a loop', () => {
    const { dependencyOptions, blockedOptions } = getTaskDependencyOptions(
      { taskId: 'b', dependencyIds: ['c'], blockedIds: ['a'] },
      tasks,
    )

    // a waits on b, so b cannot wait on it
    expect(ids(dependencyOptions)).toEqual(['c', 'd'])
    // b waits on c, so c cannot wait on b
    expect(ids(blockedOptions)).toEqual(['a', 'd'])
  })

  it('follows a loop through several tasks', () => {
    const { dependencyOptions, blockedOptions } = getTaskDependencyOptions(
      { taskId: 'c', dependencyIds: [], blockedIds: ['b'] },
      tasks,
    )

    expect(ids(dependencyOptions)).toEqual(['d'])
    expect(ids(blockedOptions)).toEqual(['a', 'b', 'd'])
  })

  it("reads a new task's picks as its links", () => {
    const { dependencyOptions, blockedOptions } = getTaskDependencyOptions(
      { taskId: null, dependencyIds: ['a'], blockedIds: ['c'] },
      tasks,
    )

    // It blocks c, which a and b wait on through each other
    expect(ids(dependencyOptions)).toEqual(['d'])
    // It waits on a, which waits on b and c
    expect(ids(blockedOptions)).toEqual(['d'])
  })

  it('ends on a loop the board holds already', () => {
    const looped = [makeTask('x', { dependencies: waitsOn('y') }), makeTask('y', { dependencies: waitsOn('x') })]

    expect(
      ids(getTaskDependencyOptions({ taskId: 'x', dependencyIds: ['y'], blockedIds: ['y'] }, looped).dependencyOptions),
    ).toEqual([])
  })
})
