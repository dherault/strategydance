import { afterEach, describe, expect, it, mock } from 'bun:test'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createTasksTestBoard } = await import('./testing/createTasksTestBoard')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const board = createTasksTestBoard(fake, ORGANIZATION_ID)

const NOT_MEMBER = 'The member is no longer in this organization, so its tasks are closed to you.'

afterEach(() => fake.reset())

// A call to each write tool, with what it names
function writes(taskId: string, otherId: string) {
  return [
    ['create_task', { name: 'New', status: 'TODO' }],
    ['update_task', { id: taskId, name: 'Renamed' }],
    ['add_task_dependency', { id: taskId, dependsOnId: otherId }],
    ['remove_task_dependency', { id: taskId, dependsOnId: otherId }],
    ['delete_task', { id: taskId }],
    ['restore_task', { id: taskId }],
  ] as const
}

describe('the caller', () => {
  it('refuses every write of a caller without the write scope, before anything is read or written', async () => {
    const kit = await board.connect({ scopes: ['tasks:read'] })
    const [task, other] = [board.add(), board.add()]
    const readOnly =
      'This connection may only read tasks. Ask the member to connect again with write access to change them.'

    fake.calls.length = 0

    for (const [name, args] of writes(task!.id, other!.id)) expect(await kit.refusal(name, args)).toBe(readOnly)

    expect(fake.calls).toEqual([])
    expect((await kit.answer<{ total: number }>('list_tasks', {})).total).toBe(2)
  })

  it('refuses every call of a removed member', async () => {
    const kit = await board.connect()
    const [task, other] = [board.add({ name: 'Plan' }), board.add()]

    fake.removeMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('list_tasks', {})).toBe(NOT_MEMBER)
    expect(await kit.refusal('list_tasks', { query: 'plan' })).toBe(NOT_MEMBER)
    expect(await kit.refusal('read_task', { id: task!.id })).toBe(NOT_MEMBER)

    for (const [name, args] of writes(task!.id, other!.id)) expect(await kit.refusal(name, args)).toBe(NOT_MEMBER)

    expect(fake.tasks.get(task!.id)!.name).toBe('Plan')
    expect(fake.tasks.size).toBe(2)
  })

  it('refuses a call carrying the membership of a member since removed and invited back', async () => {
    const kit = await board.connect()
    const task = board.add({ name: 'Plan' })

    fake.removeMember('member', ORGANIZATION_ID)
    fake.addMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('read_task', { id: task.id })).toBe(NOT_MEMBER)
    expect(await kit.refusal('update_task', { id: task.id, name: 'Renamed' })).toBe(NOT_MEMBER)
    expect(fake.tasks.get(task.id)!.name).toBe('Plan')
  })

  it('gives an external caller the web address of each task, by the slug of its organization or its id, and the agent none', async () => {
    const agent = await board.connect()
    const task = board.add({ name: 'Pricing' })

    expect(await agent.answer('read_task', { id: task.id })).not.toHaveProperty('url')
    expect((await agent.answer<{ tasks: object[] }>('list_tasks', {})).tasks[0]).not.toHaveProperty('url')

    const external = await board.connect({ kind: 'external', idempotencyScope: 'connection:checked' })
    const listed = await external.answer<{ tasks: { url: string }[] }>('list_tasks', { query: 'pricing' })

    expect(listed.tasks[0]!.url).toBe(`http://localhost:5173/${ORGANIZATION_ID}/tasks/${task.id}`)

    fake.organizations.get(ORGANIZATION_ID)!.slug = 'strategy-dance-ad34'

    const withSlug = await board.connect({ kind: 'external', idempotencyScope: 'connection:checked' })
    const reading = await withSlug.answer<{ url: string }>('read_task', { id: task.id })
    const created = await withSlug.answer<{ url: string }>('create_task', { name: 'New', status: 'TODO' })

    expect(reading.url).toBe(`http://localhost:5173/strategy-dance-ad34/tasks/${task.id}`)
    expect(created.url).toStartWith('http://localhost:5173/strategy-dance-ad34/tasks/')
  })

  it('refuses a name, a description and a query holding U+0000, and a query past 100 characters, before any operation runs', async () => {
    const kit = await board.connect()
    const task = board.add()

    fake.calls.length = 0

    for (const [name, args] of [
      ['create_task', { name: 'Bad\u0000name', status: 'TODO' }],
      ['create_task', { name: 'Fine', status: 'TODO', description: 'Bad\u0000text' }],
      ['update_task', { id: task.id, description: 'Bad\u0000text', version: 'v' }],
      ['list_tasks', { query: 'bad\u0000' }],
      ['list_tasks', { query: 'q'.repeat(101) }],
    ] as const) {
      const result = await kit.call(name, args)

      expect(result.isError).toBe(true)
      expect(JSON.stringify(result.content)).toContain('Input validation error')
    }

    expect(fake.calls).toEqual([])
  })

  it('records no day of activity for any write', async () => {
    const kit = await board.connect()
    const [task, other] = [board.add(), board.add()]

    await kit.answer('create_task', { name: 'New', status: 'TODO' })
    await kit.answer('update_task', { id: task!.id, status: 'DONE' })
    await kit.answer('add_task_dependency', { id: task!.id, dependsOnId: other!.id })
    await kit.answer('remove_task_dependency', { id: task!.id, dependsOnId: other!.id })
    await kit.answer('delete_task', { id: task!.id })
    await kit.answer('restore_task', { id: task!.id })

    expect(fake.calls.filter(call => call.includes('Activity'))).toEqual([])
    expect(fake.sdk).not.toHaveProperty('recordActivity')
  })
})
