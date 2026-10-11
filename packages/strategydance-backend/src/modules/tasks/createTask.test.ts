import { afterEach, describe, expect, it, mock } from 'bun:test'

import { MAX_TASK_DESCRIPTION_LENGTH, MAX_TASKS } from 'strategydance-core'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createTasksTestBoard } = await import('./testing/createTasksTestBoard')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const board = createTasksTestBoard(fake, ORGANIZATION_ID)

afterEach(() => fake.reset())

describe('create_task', () => {
  it("adds a task at the end of its column, the member's unless told otherwise", async () => {
    const kit = await board.connect()

    board.add({ status: 'TODO', position: 4 })
    board.add({ status: 'BACKLOG', position: 9 })

    const created = await kit.answer<{ id: string; assignee: string }>('create_task', {
      name: '  Plan  ',
      status: 'TODO',
    })
    const task = fake.tasks.get(created.id)!

    expect(created.assignee).toBe('member:member')
    expect(task).toMatchObject({
      name: 'Plan',
      status: 'TODO',
      position: 5,
      assigneeId: 'member',
      createdById: 'member',
    })
    expect(task.descriptionText).toBe('')
  })

  it('assigns a task as it is told, a member whose id is "agent" as a member', async () => {
    const kit = await board.connect()

    fake.addMember('agent', ORGANIZATION_ID)
    fake.addMember('sam', ORGANIZATION_ID)

    const toAgent = await kit.answer<{ id: string }>('create_task', { name: 'A', status: 'TODO', assignee: 'agent' })
    const toNobody = await kit.answer<{ id: string }>('create_task', {
      name: 'B',
      status: 'TODO',
      assignee: 'unassigned',
    })
    const toSam = await kit.answer<{ id: string }>('create_task', { name: 'C', status: 'TODO', assignee: 'member:sam' })
    const toMemberAgent = await kit.answer<{ id: string }>('create_task', {
      name: 'D',
      status: 'TODO',
      assignee: 'member:agent',
    })

    expect(fake.tasks.get(toAgent.id)).toMatchObject({ assigneeId: null, isAssignedToAgent: true })
    expect(fake.tasks.get(toNobody.id)).toMatchObject({ assigneeId: null, isAssignedToAgent: false })
    expect(fake.tasks.get(toSam.id)).toMatchObject({ assigneeId: 'sam', isAssignedToAgent: false })
    expect(fake.tasks.get(toMemberAgent.id)).toMatchObject({ assigneeId: 'agent', isAssignedToAgent: false })
  })

  it('refuses an assignee who is not a member, and a bare id', async () => {
    const kit = await board.connect()

    expect(await kit.refusal('create_task', { name: 'A', status: 'TODO', assignee: 'member:stranger' })).toContain(
      'not a member of the organization',
    )

    const bare = await kit.call('create_task', { name: 'A', status: 'TODO', assignee: 'sam' })

    expect(bare.isError).toBe(true)
    expect(fake.tasks.size).toBe(0)
  })

  it('refuses a name with a line break or past 120 characters', async () => {
    const kit = await board.connect()

    for (const name of ['One\nTwo', 'n'.repeat(121), '   ']) {
      expect((await kit.call('create_task', { name, status: 'TODO' })).isError).toBe(true)
    }

    expect(fake.tasks.size).toBe(0)
  })

  it("stores a description as a post's blocks, a table and code as paragraphs keeping every cell's and line's text", async () => {
    const kit = await board.connect()
    const created = await kit.answer<{ id: string }>('create_task', {
      name: 'Plan',
      status: 'TODO',
      description: '## Why\n\n| Who | What |\n| --- | --- |\n| Ada | Email |\n\n```\nline one\nline two\n```',
    })
    const task = fake.tasks.get(created.id)!

    expect(parseRichText(task.description).map(block => block.type)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'paragraph',
    ])
    expect(task.descriptionText).toBe('Why\nWho | What\nAda | Email\nline one\nline two')
  })

  it('refuses a description past what a task holds once stored, before anything is written', async () => {
    const kit = await board.connect()

    fake.calls.length = 0

    expect(
      await kit.refusal('create_task', {
        name: 'Plan',
        status: 'TODO',
        description: 'word '.repeat(MAX_TASK_DESCRIPTION_LENGTH / 5),
      }),
    ).toContain(`past ${MAX_TASK_DESCRIPTION_LENGTH} characters`)
    expect(fake.calls).toEqual([])
  })

  it('makes one task of two creates at once on a board of 999', async () => {
    const kit = await board.connect()

    for (let index = 0; index < MAX_TASKS - 1; index++) board.add({ position: index })

    // Both read the board before either writes, so the cap is held by the write's own count
    let reads = 0
    let release = () => {}
    const bothRead = new Promise<void>(resolve => {
      release = resolve
    })

    fake.beforeOperation = async name => {
      if (name !== 'CreateTaskForAgent') return
      if (++reads === 2) release()

      await bothRead
    }

    const outcomes = await Promise.all([
      kit.call('create_task', { name: 'One', status: 'TODO' }),
      kit.call('create_task', { name: 'Two', status: 'TODO' }),
    ])

    expect(outcomes.filter(outcome => !outcome.isError)).toHaveLength(1)
    expect(fake.tasks.size).toBe(MAX_TASKS)
  })
})
