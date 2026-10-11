import { afterEach, describe, expect, it, mock } from 'bun:test'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createTasksTestBoard } = await import('./testing/createTasksTestBoard')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const board = createTasksTestBoard(fake, ORGANIZATION_ID)

afterEach(() => fake.reset())

describe('read_task', () => {
  it('reads a task whole, its description as Markdown with its version, its links both ways and who made it', async () => {
    const kit = await board.connect()
    const [before, task, after] = board.chain(3)

    Object.assign(fake.tasks.get(task!.id)!, {
      ...board.describe('# Brief\n\nShip the **beta**'),
      createdById: 'member',
      assigneeId: 'member',
      aspects: ['SALES'],
    })

    const read = await kit.answer('read_task', { id: task!.id })

    expect(read).toMatchObject({
      id: task!.id,
      name: 'Step 1',
      status: 'TODO',
      assignee: 'member:member',
      assigneeName: 'Ada',
      aspects: ['SALES'],
      createdBy: { id: 'member', name: 'Ada' },
      isBlocked: true,
      dependsOn: { tasks: [{ id: before!.id, name: 'Step 0', status: 'TODO' }], count: 1 },
      waitedOnBy: { tasks: [{ id: after!.id, name: 'Step 2', status: 'TODO' }], count: 1 },
      description: '# Brief\n\nShip the **beta**',
      isDescriptionComplete: true,
    })
    expect(read.version).toMatch(/^[0-9a-f]{24}$/)
  })

  it('never blocks a done task waiting on an unfinished one', async () => {
    const kit = await board.connect()
    const [, task] = board.chain(2)

    fake.tasks.get(task!.id)!.status = 'DONE'

    expect((await kit.answer('read_task', { id: task!.id })).isBlocked).toBe(false)
  })

  it('refuses a task deleted or unknown', async () => {
    const kit = await board.connect()
    const task = board.add({ deletedAt: new Date().toISOString() })

    expect(await kit.refusal('read_task', { id: task.id })).toContain('No task on the board has that id')
    expect(await kit.refusal('read_task', { id: crypto.randomUUID() })).toContain('No task on the board has that id')
  })

  it('reads a task with the longest description and the most links within 45000 characters, its description as plain text', async () => {
    const kit = await board.connect()
    const text = '*\\'.repeat(6600)
    const description = JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text }] }])
    const task = board.add({ name: 'n'.repeat(120), description, descriptionText: text })
    const name = (index: number) => `${'n'.repeat(116)}${String(index).padStart(4, '0')}`

    expect(description.length).toBeLessThanOrEqual(20000)

    for (let index = 0; index < 50; index++) fake.link(task.id, board.add({ name: name(index) }).id)
    for (let index = 0; index < 949; index++) fake.link(board.add({ name: name(index + 50) }).id, task.id)

    const result = await kit.call('read_task', { id: task.id })
    const read = result.structuredContent as Record<string, any>

    expect(JSON.stringify(read).length).toBeLessThanOrEqual(45000)
    expect(read.isDescriptionComplete).toBe(false)
    expect(read).not.toHaveProperty('version')
    expect(text.startsWith(read.description)).toBe(true)
    expect(read.description.length).toBeGreaterThan(1000)
    expect(read.dependsOn.tasks).toHaveLength(20)
    expect(read.dependsOn.count).toBe(50)
    expect(read.waitedOnBy.tasks).toHaveLength(20)
    expect(read.waitedOnBy.count).toBe(949)
  })
})
