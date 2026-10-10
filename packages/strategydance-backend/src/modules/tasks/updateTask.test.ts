import { afterEach, describe, expect, it, mock } from 'bun:test'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createTasksTestBoard } = await import('./testing/createTasksTestBoard')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const board = createTasksTestBoard(fake, ORGANIZATION_ID)

const CHANGED = "The task's description changed since you read it. Read it again first."

afterEach(() => fake.reset())

describe('update_task', () => {
  it('changes the fields a call names and no other', async () => {
    const kit = await board.connect()
    const task = board.add({ name: 'Plan', aspects: ['SALES'], dueDate: '2026-10-20', assigneeId: 'member' })

    await kit.answer('update_task', { id: task.id, name: 'Renamed' })

    expect(fake.tasks.get(task.id)).toMatchObject({
      name: 'Renamed',
      aspects: ['SALES'],
      dueDate: '2026-10-20',
      assigneeId: 'member',
    })

    await kit.answer('update_task', { id: task.id, dueDate: null, aspects: ['LEGAL', 'PEOPLE'] })

    expect(fake.tasks.get(task.id)).toMatchObject({ name: 'Renamed', aspects: ['LEGAL', 'PEOPLE'], dueDate: null })
  })

  it('refuses a call naming no field, beforeId without status, version without description, and a repeated aspect', async () => {
    const kit = await board.connect()
    const task = board.add()

    fake.calls.length = 0

    for (const args of [
      { id: task.id },
      { id: task.id, beforeId: task.id, name: 'Renamed' },
      { id: task.id, version: 'v', name: 'Renamed' },
      { id: task.id, aspects: ['SALES', 'SALES'] },
    ]) {
      expect((await kit.call('update_task', args)).isError).toBe(true)
    }

    expect(fake.calls).toEqual([])
  })

  it('takes a task off its member for Strategy Dance, then off everybody', async () => {
    const kit = await board.connect()
    const task = board.add({ assigneeId: 'member' })

    await kit.answer('update_task', { id: task.id, assignee: 'agent' })

    expect(fake.tasks.get(task.id)).toMatchObject({ assigneeId: null, isAssignedToAgent: true })

    await kit.answer('update_task', { id: task.id, assignee: 'unassigned' })

    expect(fake.tasks.get(task.id)).toMatchObject({ assigneeId: null, isAssignedToAgent: false })
    expect(await kit.refusal('update_task', { id: task.id, assignee: 'member:stranger' })).toContain('not a member')
  })

  it('replaces a description read whole with its version, and refuses a stale version or none, nothing written', async () => {
    const kit = await board.connect()
    const task = board.add(board.describe('Before'))
    const read = await kit.answer<{ version: string }>('read_task', { id: task.id })

    board.add()
    fake.changeTask(task.id, board.describe('A member saved this'))

    expect(await kit.refusal('update_task', { id: task.id, description: 'Mine', version: read.version })).toBe(CHANGED)
    expect(await kit.refusal('update_task', { id: task.id, description: 'Mine' })).toContain('takes the version')
    expect(fake.tasks.get(task.id)!.descriptionText).toBe('A member saved this')

    const again = await kit.answer<{ version: string }>('read_task', { id: task.id })
    const replaced = await kit.answer<{ version: string }>('update_task', {
      id: task.id,
      description: 'Mine',
      version: again.version,
    })

    expect(fake.tasks.get(task.id)!.descriptionText).toBe('Mine')
    expect(replaced.version).toBe((await kit.answer<{ version: string }>('read_task', { id: task.id })).version)
    expect(await kit.answer('update_task', { id: task.id, description: '', version: replaced.version })).toBeTruthy()
    expect(fake.tasks.get(task.id)).toMatchObject({ description: '', descriptionText: '' })
  })

  it('refuses a description a member saves between the read and the write, rather than write over it', async () => {
    const kit = await board.connect()
    const task = board.add(board.describe('Before'))
    const { version } = await kit.answer<{ version: string }>('read_task', { id: task.id })

    fake.beforeOperation = async name => {
      if (name === 'UpdateTaskForAgent') fake.changeTask(task.id, board.describe('Saved meanwhile'))
    }

    expect(await kit.refusal('update_task', { id: task.id, description: 'Mine', version })).toBe(CHANGED)
    expect(fake.tasks.get(task.id)!.descriptionText).toBe('Saved meanwhile')
  })

  it("keeps a member's rename landing during the agent's move, reading again and moving it", async () => {
    const kit = await board.connect()
    const task = board.add({ name: 'Plan', status: 'TODO' })
    let hasRenamed = false

    fake.beforeOperation = async name => {
      if (name !== 'UpdateTaskForAgent' || hasRenamed) return

      hasRenamed = true
      fake.changeTask(task.id, { name: 'Renamed by a member' })
    }

    await kit.answer('update_task', { id: task.id, status: 'ONGOING' })

    expect(fake.tasks.get(task.id)).toMatchObject({ name: 'Renamed by a member', status: 'ONGOING' })
    expect(fake.calls.filter(call => call === 'UpdateTaskForAgent')).toHaveLength(2)
  })

  it('moves a task halfway between two, to the end of a column, or leaves it where it is before itself', async () => {
    const kit = await board.connect()
    const [first, second] = [board.add({ status: 'TODO', position: 1 }), board.add({ status: 'TODO', position: 2 })]
    const moved = board.add({ status: 'BACKLOG', position: 1 })

    await kit.answer('update_task', { id: moved.id, status: 'TODO', beforeId: second!.id })

    expect(fake.tasks.get(moved.id)).toMatchObject({ status: 'TODO', position: 1.5 })

    await kit.answer('update_task', { id: moved.id, status: 'TODO' })

    expect(fake.tasks.get(moved.id)!.position).toBe(3)

    await kit.answer('update_task', { id: moved.id, status: 'TODO', beforeId: moved.id })

    expect(fake.tasks.get(moved.id)!.position).toBe(3)
    expect(await kit.refusal('update_task', { id: moved.id, status: 'DONE', beforeId: moved.id })).toContain(
      'beforeId names no task of the column',
    )
    expect(await kit.refusal('update_task', { id: first!.id, status: 'DONE', beforeId: second!.id })).toContain(
      'beforeId names no task of the column',
    )
  })

  it('refuses a move into a gap too narrow for a float, nothing written', async () => {
    const kit = await board.connect()
    const after = board.add({ status: 'TODO', position: 1 + Number.EPSILON })
    const task = board.add({ status: 'BACKLOG', position: 1 })

    board.add({ status: 'TODO', position: 1 })

    expect(await kit.refusal('update_task', { id: task.id, status: 'TODO', beforeId: after.id })).toContain(
      'no room left',
    )
    expect(fake.tasks.get(task.id)).toMatchObject({ status: 'BACKLOG', position: 1 })
  })

  it('answers the tasks a move to Done frees on a board of 1000 waiting on one, the first 50 and their count, within a result', async () => {
    const kit = await board.connect()
    const task = board.add({ name: 'First', status: 'ONGOING' })
    const waiting = Array.from({ length: 999 }, (_, index) =>
      board.add({ name: `${'w'.repeat(110)} ${String(index).padStart(3, '0')}`, position: index }),
    )

    for (const other of waiting) fake.link(other.id, task.id)

    const result = await kit.call('update_task', { id: task.id, status: 'DONE' })
    const moved = result.structuredContent as { canStartNow: { tasks: { id: string }[]; count: number } }

    expect(moved.canStartNow.count).toBe(999)
    expect(moved.canStartNow.tasks).toHaveLength(50)
    expect(moved.canStartNow.tasks.map(({ id }) => id)).toEqual(waiting.slice(0, 50).map(({ id }) => id))
    expect(JSON.stringify(result.structuredContent).length).toBeLessThan(50000)
  })
})
