import { afterEach, describe, expect, it, mock, setSystemTime } from 'bun:test'

import { MAX_TASKS } from 'strategydance-core'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createTasksTestBoard } = await import('./testing/createTasksTestBoard')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const board = createTasksTestBoard(fake, ORGANIZATION_ID)

const HOUR_MS = 60 * 60 * 1000

afterEach(() => {
  fake.reset()
  setSystemTime()
})

describe('delete_task and restore_task', () => {
  it('deletes a task keeping its links, for a day, and restores it with them', async () => {
    const kit = await board.connect()
    const [first, task, last] = board.chain(3)
    const deleted = await kit.answer<{ restorableUntil: string }>('delete_task', { id: task!.id })

    expect(Date.parse(deleted.restorableUntil) - Date.now()).toBeGreaterThan(23 * HOUR_MS)
    expect(fake.dependencies).toHaveLength(2)
    expect((await kit.answer<{ total: number }>('list_tasks', {})).total).toBe(2)
    expect(await kit.refusal('delete_task', { id: task!.id })).toContain('No task on the board')

    await kit.answer('restore_task', { id: task!.id })

    const read = await kit.answer('read_task', { id: task!.id })

    expect(read.dependsOn.tasks.map(({ id }: { id: string }) => id)).toEqual([first!.id])
    expect(read.waitedOnBy.tasks.map(({ id }: { id: string }) => id)).toEqual([last!.id])
    expect(await kit.refusal('restore_task', { id: task!.id })).toContain('not deleted')
  })

  it('refuses a restore past a day, and of a task never there', async () => {
    const kit = await board.connect()
    const task = board.add({ deletedAt: new Date(Date.now() - 25 * HOUR_MS).toISOString() })

    expect(await kit.refusal('restore_task', { id: task.id })).toBe(
      'The task was deleted over a day ago and is gone for good.',
    )
    expect(await kit.refusal('restore_task', { id: crypto.randomUUID() })).toContain('No task on the board')
  })

  it('says a task another call restored meanwhile is not deleted, rather than gone or the board full', async () => {
    const kit = await board.connect()
    const task = board.add({ deletedAt: new Date().toISOString() })

    fake.beforeOperation = async name => {
      if (name === 'RestoreTaskForAgent') fake.tasks.get(task.id)!.deletedAt = null
    }

    expect(await kit.refusal('restore_task', { id: task.id })).toBe(
      'The task is not deleted, so there is nothing to restore.',
    )

    const other = board.add({ deletedAt: new Date().toISOString() })

    // With the first task back, the board holds 999 live tasks as the restore reads it
    for (let index = 0; index < MAX_TASKS - 2; index++) board.add()

    // Restored meanwhile, which fills the board's last place
    fake.beforeOperation = async name => {
      if (name === 'RestoreTaskForAgent') fake.tasks.get(other.id)!.deletedAt = null
    }

    expect(await kit.refusal('restore_task', { id: other.id })).toBe(
      'The task is not deleted, so there is nothing to restore.',
    )
    expect(fake.calls.filter(call => call === 'GetTaskForAgent')).toHaveLength(4)
  })

  it('refuses a restore at the cap', async () => {
    const kit = await board.connect()
    const task = board.add({ deletedAt: new Date().toISOString() })

    for (let index = 0; index < MAX_TASKS; index++) board.add()

    expect(await kit.refusal('restore_task', { id: task.id })).toContain(`holds ${MAX_TASKS} tasks`)
  })

  it('refuses a restore whose kept links would close a loop with one made while it was deleted, naming them', async () => {
    const kit = await board.connect()
    // C waits on B, which waits on A
    const [a, b, c] = board.chain(3)

    await kit.answer('delete_task', { id: b!.id })
    // Made while B was gone: A waits on C, a loop once B is back
    await kit.answer('add_task_dependency', { id: a!.id, dependsOnId: c!.id })

    expect(await kit.refusal('restore_task', { id: b!.id })).toBe(
      `Restoring the task would close a loop through 1 task waiting on it: "Step 2" (${c!.id}). Remove one of those links first, with remove_task_dependency naming that task and the deleted one.`,
    )

    await kit.answer('remove_task_dependency', { id: c!.id, dependsOnId: b!.id })
    await kit.answer('restore_task', { id: b!.id })

    expect(fake.tasks.get(b!.id)!.deletedAt).toBeNull()
  })

  it('prunes the tasks deleted over a day ago as it deletes another', async () => {
    const kit = await board.connect()
    const old = board.add({ deletedAt: new Date(Date.now() - 25 * HOUR_MS).toISOString() })
    const task = board.add()

    await kit.answer('delete_task', { id: task.id })

    expect(fake.tasks.has(old.id)).toBe(false)
    expect(fake.tasks.has(task.id)).toBe(true)
  })
})
