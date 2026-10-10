import { describe, expect, it } from 'bun:test'

import type { TaskLinks } from '../types'

import { getTaskBlockers, getTaskPrerequisites, getTasksUnblockedBy, isTaskBlocked } from './task'

function makeTask(id: string, dependencyIds: string[] = [], isDone = false): TaskLinks {
  return { id, isDone, dependencyIds }
}

function byId(tasks: readonly TaskLinks[]) {
  return new Map(tasks.map(task => [task.id, task]))
}

describe('getTaskBlockers', () => {
  it('lists what a task waits on that is not done', () => {
    const tasks = [makeTask('a', ['b', 'c', 'gone']), makeTask('b', [], true), makeTask('c')]

    expect(getTaskBlockers(tasks[0]!, byId(tasks))).toEqual(['c'])
  })
})

describe('isTaskBlocked', () => {
  it('blocks a task waiting on an unfinished one, and never a done one', () => {
    const tasks = [makeTask('a', ['c']), makeTask('b', ['c'], true), makeTask('c')]

    expect(isTaskBlocked(tasks[0]!, byId(tasks))).toBe(true)
    expect(isTaskBlocked(tasks[1]!, byId(tasks))).toBe(false)
    expect(isTaskBlocked(tasks[2]!, byId(tasks))).toBe(false)
  })
})

describe('getTasksUnblockedBy', () => {
  it('frees the tasks waiting on nothing else unfinished', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', ['a']),
      makeTask('c', ['a', 'd']),
      makeTask('d'),
      makeTask('e', ['a'], true),
      makeTask('f', ['a', 'g']),
      makeTask('g', [], true),
    ]

    expect(getTasksUnblockedBy('a', tasks)).toEqual(['b', 'f'])
  })
})

describe('getTaskPrerequisites', () => {
  it('follows what a task waits on through others, and ends on a loop the board holds', () => {
    const tasks = [makeTask('a', ['b']), makeTask('b', ['c']), makeTask('c', ['a']), makeTask('d', ['a'])]

    expect([...getTaskPrerequisites(['a'], tasks)].sort()).toEqual(['a', 'b', 'c'])
    expect([...getTaskPrerequisites(['d'], tasks)].sort()).toEqual(['a', 'b', 'c'])
    expect(getTaskPrerequisites(['unknown'], tasks).size).toBe(0)
  })
})
