import { afterEach, describe, expect, it, mock } from 'bun:test'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createTasksTestBoard } = await import('./testing/createTasksTestBoard')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const board = createTasksTestBoard(fake, ORGANIZATION_ID)

type Page = {
  tasks: { id: string; name: string; isBlocked: boolean; dependsOnIds: string[] }[]
  total: number
  members?: { id: string; name: string | null }[]
  cursor?: string
  isIndexComplete?: boolean
}

afterEach(() => fake.reset())

// Every page of a list, following the cursor
async function listAll(kit: Awaited<ReturnType<typeof board.connect>>, args: Record<string, unknown> = {}) {
  const pages: Page[] = []
  let cursor: string | undefined

  do {
    const page: Page = await kit.answer<Page>('list_tasks', { ...args, ...(cursor && { cursor }) })

    pages.push(page)
    cursor = page.cursor
  } while (cursor)

  return pages
}

describe('list_tasks', () => {
  it('lists the board column by column in its order, with the members on the first page', async () => {
    const kit = await board.connect()
    const done = board.add({ name: 'Done', status: 'DONE', position: 0 })
    const later = board.add({ name: 'Later', status: 'TODO', position: 2 })
    const sooner = board.add({ name: 'Sooner', status: 'TODO', position: 1 })
    const idea = board.add({ name: 'Idea', status: 'BACKLOG', position: 5 })

    board.add({ name: 'Gone', deletedAt: new Date().toISOString() })

    const page = await kit.answer<Page>('list_tasks', {})

    expect(page.tasks.map(({ id }) => id)).toEqual([idea.id, sooner.id, later.id, done.id])
    expect(page.total).toBe(4)
    expect(page.members).toEqual([{ id: 'member', name: 'Ada' }])
    expect(page).not.toHaveProperty('cursor')
  })

  it('pages in hundreds, neither skipping nor repeating two tasks at one position across a page end, the members on the first page alone', async () => {
    const kit = await board.connect()
    const tasks = Array.from({ length: 250 }, (_, index) => board.add({ position: index < 101 ? 1 : index }))
    const pages = await listAll(kit)
    const ids = pages.flatMap(page => page.tasks.map(({ id }) => id))

    expect(pages.map(page => page.tasks.length)).toEqual([100, 100, 50])
    expect(pages.map(page => page.total)).toEqual([250, 250, 250])
    expect(pages.map(page => 'members' in page)).toEqual([true, false, false])
    expect(new Set(ids).size).toBe(250)
    expect(ids.sort()).toEqual(tasks.map(({ id }) => id).sort())
  })

  it('keeps a page within 40000 characters, cutting it short of 100 when it must', async () => {
    const kit = await board.connect()
    const others = Array.from({ length: 50 }, (_, index) => board.add({ name: `Other ${index}`, status: 'DONE' }))

    for (let index = 0; index < 100; index++) {
      const task = board.add({ name: 'n'.repeat(120), position: index })

      for (const other of others) fake.link(task.id, other.id)
    }

    const pages = await listAll(kit, { status: 'TODO' })

    expect(pages[0]!.tasks.length).toBeLessThan(100)
    expect(pages.flatMap(page => page.tasks)).toHaveLength(100)

    for (const page of pages) expect(JSON.stringify(page).length).toBeLessThanOrEqual(40000)
  })

  it('refuses a cursor it did not give', async () => {
    const kit = await board.connect()

    expect(await kit.refusal('list_tasks', { cursor: 'made-up' })).toContain('not one this tool gave')
  })

  it('finds a query in a name and in a description, whatever its case, one half in bold included', async () => {
    const kit = await board.connect()
    const named = board.add({ name: 'Launch the Newsletter' })
    const described = board.add({ name: 'Other', ...board.describe('Write the **news**letter draft') })

    board.add({ name: 'Unrelated', ...board.describe('Nothing here') })

    const page = await kit.answer<Page>('list_tasks', { query: 'NEWSLETTER' })

    expect(page.tasks.map(({ id }) => id).sort()).toEqual([named.id, described.id].sort())
    expect(page.isIndexComplete).toBe(true)
  })

  it("matches a description's words, never the structure it is stored in", async () => {
    const kit = await board.connect()

    board.add({ name: 'Plan', ...board.describe('Write a draft') })

    expect((await kit.answer<Page>('list_tasks', { query: 'type' })).tasks).toEqual([])
    expect((await kit.answer<Page>('list_tasks', { query: 'text' })).tasks).toEqual([])
  })

  it('matches %, _ and \\ as written, never as wildcards', async () => {
    const kit = await board.connect()
    const percent = board.add({ name: 'Grow 10% a month' })
    const underscore = board.add({ name: 'Rename snake_case keys' })
    const backslash = board.add({ name: 'Fix C:\\temp paths' })

    board.add({ name: 'Grow 10 a month' })
    board.add({ name: 'Rename snakeXcase keys' })

    expect((await kit.answer<Page>('list_tasks', { query: '10%' })).tasks.map(({ id }) => id)).toEqual([percent.id])
    expect((await kit.answer<Page>('list_tasks', { query: 'snake_case' })).tasks.map(({ id }) => id)).toEqual([
      underscore.id,
    ])
    expect((await kit.answer<Page>('list_tasks', { query: ':\\temp' })).tasks.map(({ id }) => id)).toEqual([
      backslash.id,
    ])
  })

  it('indexes 20 tasks a page from before left unindexed before a query, saying when more remain', async () => {
    const kit = await board.connect()

    for (let index = 0; index < 25; index++) {
      board.add({ name: `Task ${index}`, ...board.describe('Hidden word'), descriptionText: null })
    }

    const first = await kit.answer<Page>('list_tasks', { query: 'hidden' })

    expect(first.tasks).toHaveLength(20)
    expect(first.isIndexComplete).toBe(false)

    const second = await kit.answer<Page>('list_tasks', { query: 'hidden' })

    expect(second.tasks).toHaveLength(25)
    expect(second.isIndexComplete).toBe(true)
    expect((await kit.answer<Page>('list_tasks', {})).isIndexComplete).toBeUndefined()
  })

  it('leaves unindexed a description saved between the index read and its write', async () => {
    const kit = await board.connect()
    const task = board.add({ ...board.describe('Old words'), descriptionText: null })

    fake.beforeOperation = async name => {
      if (name === 'IndexTaskTextForAgent')
        fake.changeTask(task.id, { ...board.describe('New words'), descriptionText: null })
    }

    const page = await kit.answer<Page>('list_tasks', { query: 'words' })

    expect(page.tasks).toEqual([])
    expect(page.isIndexComplete).toBe(false)
    expect(fake.tasks.get(task.id)!.descriptionText).toBeNull()
  })

  it('filters by status, assignee and aspects, any of them', async () => {
    const kit = await board.connect()

    fake.addMember('sam', ORGANIZATION_ID)

    const mine = board.add({ assigneeId: 'member', aspects: ['SALES'] })
    const agents = board.add({ isAssignedToAgent: true, aspects: ['LEGAL'] })
    const nobodys = board.add({ status: 'DONE', aspects: ['PEOPLE'] })
    const sams = board.add({ assigneeId: 'sam' })
    const ids = async (args: Record<string, unknown>) =>
      (await kit.answer<Page>('list_tasks', args)).tasks.map(({ id }) => id)

    expect(await ids({ assignee: 'me' })).toEqual([mine.id])
    expect(await ids({ assignee: 'agent' })).toEqual([agents.id])
    expect(await ids({ assignee: 'unassigned' })).toEqual([nobodys.id])
    expect(await ids({ assignee: 'member:sam' })).toEqual([sams.id])
    expect(await ids({ status: 'DONE' })).toEqual([nobodys.id])
    expect((await ids({ aspects: ['SALES', 'LEGAL'] })).sort()).toEqual([mine.id, agents.id].sort())
  })

  it('never blocks a done task waiting on an unfinished one', async () => {
    const kit = await board.connect()
    const [first, second] = board.chain(2)

    fake.tasks.get(second!.id)!.status = 'DONE'

    const page = await kit.answer<Page>('list_tasks', {})

    expect(page.tasks.find(({ id }) => id === second!.id)).toMatchObject({
      isBlocked: false,
      dependsOnIds: [first!.id],
    })
  })
})
