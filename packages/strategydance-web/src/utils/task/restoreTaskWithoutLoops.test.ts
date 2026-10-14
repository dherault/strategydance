import { describe, expect, it } from 'bun:test'

import { getTaskPrerequisites } from 'strategydance-core'
import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import restoreTaskWithoutLoops from '~utils/task/restoreTaskWithoutLoops'
import toTaskLinks from '~utils/task/toTaskLinks'

function makeTask(id: string): Task {
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
    dependencies: [],
    linkCount: [{ _count: 0 }],
  }
}

/*
  A board as the server keeps it: its tasks, the deleted ones among them, and every link, a deleted
  task's included, read as `GetTasks` reads them, live tasks with their links to live tasks alone
*/
function createBoard(ids: string[], deletedIds: string[], links: [string, string][]) {
  const deleted = new Set(deletedIds)
  const kept = [...links]
  const writes: string[] = []

  function readTasks() {
    return ids
      .filter(id => !deleted.has(id))
      .map(id => ({
        ...makeTask(id),
        dependencies: kept
          .filter(([taskId, dependencyId]) => taskId === id && !deleted.has(dependencyId))
          .map(([, dependencyId]) => ({ dependencyId })),
      }))
  }

  return {
    writes,
    links: kept,
    readTasks: async () => readTasks(),
    restore: (id: string) => async () => {
      writes.push(`restore ${id}`)
      deleted.delete(id)
    },
    unlink: (dependencyId: string) => async (taskId: string) => {
      writes.push(`unlink ${taskId} from ${dependencyId}`)
      kept.splice(
        kept.findIndex(link => link[0] === taskId && link[1] === dependencyId),
        1,
      )
    },
    hasLoop: () => readTasks().some(task => getTaskPrerequisites([task.id], readTasks().map(toTaskLinks)).has(task.id)),
  }
}

describe('restoreTaskWithoutLoops', () => {
  it('brings a task back with its links, taking off the one that closes a loop with a link made while it was gone', async () => {
    // The deleted task waits on A, and B waits on it, links the server kept. Meanwhile A was made to wait on B
    const board = createBoard(
      ['a', 'b', 'deleted'],
      ['deleted'],
      [
        ['deleted', 'a'],
        ['b', 'deleted'],
        ['a', 'b'],
      ],
    )

    await restoreTaskWithoutLoops('deleted', {
      restore: board.restore('deleted'),
      readTasks: board.readTasks,
      unlink: board.unlink('deleted'),
    })

    expect(board.writes).toEqual(['restore deleted', 'unlink b from deleted'])
    expect(board.links).toEqual([
      ['deleted', 'a'],
      ['a', 'b'],
    ])
    expect(board.hasLoop()).toBe(false)
  })

  it('takes nothing off when no link closes a loop', async () => {
    const board = createBoard(
      ['a', 'b', 'deleted'],
      ['deleted'],
      [
        ['deleted', 'a'],
        ['b', 'deleted'],
      ],
    )

    await restoreTaskWithoutLoops('deleted', {
      restore: board.restore('deleted'),
      readTasks: board.readTasks,
      unlink: board.unlink('deleted'),
    })

    expect(board.writes).toEqual(['restore deleted'])
    expect(board.links).toHaveLength(2)
  })
})
