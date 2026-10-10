import { afterEach, describe, expect, it, mock } from 'bun:test'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createTasksTestBoard } = await import('./testing/createTasksTestBoard')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const board = createTasksTestBoard(fake, ORGANIZATION_ID)

const CONFLICT = 'That idempotency key was sent before with another call. Send a new key with each new call.'

afterEach(() => fake.reset())

describe('idempotency keys', () => {
  it('creates once under one key, the second call answered with the first result', async () => {
    const kit = await board.connect()
    const args = { name: 'Plan', status: 'TODO' }
    const first = await kit.answer<{ id: string }>('create_task', args, 'key-1')
    const second = await kit.answer<{ id: string }>('create_task', { status: 'TODO', name: 'Plan' }, 'key-1')

    expect(second).toEqual(first)
    expect(fake.tasks.size).toBe(1)
  })

  it('refuses a key sent again with other arguments, or to another tool with the same ones', async () => {
    const kit = await board.connect()
    const task = board.add({ name: 'Plan' })

    await kit.answer('update_task', { id: task.id, name: 'Once' }, 'key-1')

    expect(await kit.refusal('update_task', { id: task.id, name: 'Twice' }, 'key-1')).toBe(CONFLICT)

    await kit.answer('delete_task', { id: task.id }, 'key-2')

    expect(await kit.refusal('restore_task', { id: task.id }, 'key-2')).toBe(CONFLICT)
    expect(fake.tasks.get(task.id)!.name).toBe('Once')
    expect(fake.tasks.get(task.id)!.deletedAt).not.toBeNull()
  })

  it('makes one write of two calls at once under one key', async () => {
    const kit = await board.connect()
    const [first, second] = await Promise.all([
      kit.answer<{ id: string }>('create_task', { name: 'Plan', status: 'TODO' }, 'key-1'),
      kit.answer<{ id: string }>('create_task', { name: 'Plan', status: 'TODO' }, 'key-1'),
    ])

    expect(second).toEqual(first)
    expect(fake.tasks.size).toBe(1)
    expect(fake.results.size).toBe(1)
  })

  it('answers a move under its key with what it answered first, the tasks it freed included', async () => {
    const kit = await board.connect()
    const [first, second] = board.chain(2)
    const args = { id: first!.id, status: 'DONE' }
    const moved = await kit.answer('update_task', args, 'key-1')

    expect(moved.canStartNow).toEqual({ tasks: [{ id: second!.id, name: 'Step 1' }], count: 1 })
    expect(await kit.answer('update_task', args, 'key-1')).toEqual(moved)
  })
})
