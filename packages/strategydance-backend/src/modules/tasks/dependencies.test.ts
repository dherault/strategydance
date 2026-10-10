import { afterEach, describe, expect, it, mock } from 'bun:test'

import { MAX_TASK_DEPENDENCIES } from 'strategydance-core'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createTasksTestBoard } = await import('./testing/createTasksTestBoard')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const board = createTasksTestBoard(fake, ORGANIZATION_ID)

afterEach(() => fake.reset())

describe('add_task_dependency', () => {
  it('makes a task wait on another and says it is blocked, and that a link that exists is not new', async () => {
    const kit = await board.connect()
    const [task, other] = [board.add({ name: 'Ship' }), board.add({ name: 'Build' })]
    const added = await kit.answer('add_task_dependency', { id: task!.id, dependsOnId: other!.id })

    expect(added).toMatchObject({ isNew: true, isBlocked: true })
    expect((await kit.answer('add_task_dependency', { id: task!.id, dependsOnId: other!.id })).isNew).toBe(false)
    expect(fake.dependencies).toHaveLength(1)
  })

  it('refuses a task waiting on itself, and loops of two and of three, naming their tasks', async () => {
    const kit = await board.connect()
    const [a, b, c] = board.chain(3)

    expect(await kit.refusal('add_task_dependency', { id: a!.id, dependsOnId: a!.id })).toBe(
      'A task cannot wait on itself.',
    )
    expect(await kit.refusal('add_task_dependency', { id: a!.id, dependsOnId: b!.id })).toBe(
      `That link would close a loop of 2 tasks, each waiting on the next and the last on the first: "Step 0" (${a!.id}), "Step 1" (${b!.id}). Remove one of the links in it first, or leave this one out.`,
    )
    expect(await kit.refusal('add_task_dependency', { id: a!.id, dependsOnId: c!.id })).toContain(
      `a loop of 3 tasks, each waiting on the next and the last on the first: "Step 0" (${a!.id}), "Step 2" (${c!.id}), "Step 1" (${b!.id}).`,
    )
    expect(fake.dependencies).toHaveLength(2)
  })

  it('refuses a loop through all 1000 tasks, naming its first 20 and its length', async () => {
    const kit = await board.connect()
    const tasks = board.chain(1000)
    const refusal = await kit.refusal('add_task_dependency', { id: tasks[0]!.id, dependsOnId: tasks[999]!.id })

    expect(refusal).toContain('a loop of 1000 tasks')
    expect(refusal.match(/"Step \d+"/g)).toHaveLength(20)
    expect(refusal).toContain(', and more.')
    expect(refusal.length).toBeLessThan(2000)
  })

  it('refuses a 51st link, counting those to deleted tasks', async () => {
    const kit = await board.connect()
    const task = board.add()

    for (let index = 0; index < MAX_TASK_DEPENDENCIES - 1; index++) fake.link(task.id, board.add().id)

    fake.link(task.id, board.add({ deletedAt: new Date().toISOString() }).id)

    expect(await kit.refusal('add_task_dependency', { id: task.id, dependsOnId: board.add().id })).toBe(
      `A task waits on at most ${MAX_TASK_DEPENDENCIES} others. Remove a link first.`,
    )
  })

  it('refuses a task deleted or unknown', async () => {
    const kit = await board.connect()
    const task = board.add()
    const gone = board.add({ deletedAt: new Date().toISOString() })

    expect(await kit.refusal('add_task_dependency', { id: task.id, dependsOnId: gone.id })).toContain(
      'No task on the board',
    )
  })
})

describe('remove_task_dependency', () => {
  it('stops a task waiting on another and says whether it can start now', async () => {
    const kit = await board.connect()
    const [first, second] = board.chain(2)
    const removed = await kit.answer('remove_task_dependency', { id: second!.id, dependsOnId: first!.id })

    expect(removed).toMatchObject({ isBlocked: false, canStart: true })
    expect(fake.dependencies).toEqual([])
  })

  it('never blocks a done task waiting on an unfinished one, nor says it can start', async () => {
    const kit = await board.connect()
    const [first, second, third] = board.chain(3)

    fake.link(third!.id, first!.id)
    fake.tasks.get(third!.id)!.status = 'DONE'

    expect(await kit.answer('remove_task_dependency', { id: third!.id, dependsOnId: second!.id })).toMatchObject({
      isBlocked: false,
      canStart: false,
    })
  })

  it('refuses a link that is not there', async () => {
    const kit = await board.connect()
    const [task, other] = [board.add(), board.add()]

    expect(await kit.refusal('remove_task_dependency', { id: task!.id, dependsOnId: other!.id })).toBe(
      'The task does not wait on that one, so there is no link to remove.',
    )
  })
})
