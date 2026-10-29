import { afterEach, beforeEach, describe, expect, it, mock, setSystemTime } from 'bun:test'

import { MAX_CONVERSATION_SEARCHES } from 'strategydance-core'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createBudgetTestBills } = await import('./testing/createBudgetTestBills')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const book = createBudgetTestBills(fake, ORGANIZATION_ID)

type Page = { bills: { id: string; name: string }[]; total: number; nextCursor?: string }

beforeEach(() => setSystemTime(new Date('2026-10-19T12:00:00Z')))

afterEach(() => {
  fake.reset()
  setSystemTime()
})

// Every page of a list, each with the length of the text the tool answered
async function readPages(kit: Awaited<ReturnType<typeof book.connect>>, filters: Record<string, unknown> = {}) {
  const pages: (Page & { length: number })[] = []
  let cursor: string | undefined

  do {
    const result = await kit.call('list_bills', { ...filters, ...(cursor && { cursor }) })
    const [content] = result.content as { text: string }[]
    const page = result.structuredContent as Page

    pages.push({ ...page, length: content!.text.length })
    cursor = page.nextCursor
  } while (cursor)

  return pages
}

describe('list_bills', () => {
  it('pages 2000 bills by 50, each page within a result, none skipped nor repeated', async () => {
    const kit = await book.connect()

    for (let index = 0; index < 2000; index++) book.add({ name: `Bill ${index}`, paidOn: '2026-10-01' })

    const pages = await readPages(kit)
    const ids = pages.flatMap(page => page.bills.map(bill => bill.id))

    expect(pages).toHaveLength(40)
    expect(pages.every(page => page.bills.length === 50 && page.total === 2000 && page.length < 50000)).toBe(true)
    expect(new Set(ids).size).toBe(2000)
  })

  it('cuts a page short of 50 bills whose every character JSON escapes, within 50000 characters', async () => {
    const kit = await book.connect()

    fake.setName('member', '\u0001'.repeat(200))

    for (let index = 0; index < 200; index++) {
      book.add({
        name: '"'.repeat(80),
        description: '\u0001'.repeat(140),
        company: '\\'.repeat(60),
        recurrence: 'WEEKLY',
        paidOn: '2026-01-01',
      })
    }

    const pages = await readPages(kit)
    const ids = pages.flatMap(page => page.bills.map(bill => bill.id))

    expect(pages.length).toBeGreaterThan(4)
    expect(pages.every(page => page.bills.length < 50 && page.length < 50000)).toBe(true)
    expect(new Set(ids).size).toBe(200)
  })

  it('lists the latest paid first, then by id', async () => {
    const kit = await book.connect()

    book.add({ name: 'Old', paidOn: '2026-01-05' })
    book.add({ name: 'Monthly', paidOn: '2025-06-18', recurrence: 'MONTHLY' })
    book.add({ name: 'Ahead', paidOn: '2026-12-01' })

    expect((await kit.answer<Page>('list_bills', {})).bills.map(bill => bill.name)).toEqual(['Ahead', 'Monthly', 'Old'])
  })

  it('matches every word of a query in a name, a description or a company, whatever its case', async () => {
    const kit = await book.connect()

    book.add({ name: 'Cloud hosting', company: 'Amazon Web Services' })
    book.add({ name: 'Domain', description: 'Hosting of the landing page', company: 'Namecheap' })
    book.add({ name: 'Figma', company: 'Figma' })

    const names = async (query: string) =>
      (await kit.answer<Page>('list_bills', { query })).bills.map(bill => bill.name).sort()

    expect(await names('HOSTING')).toEqual(['Cloud hosting', 'Domain'])
    expect(await names('hosting amazon')).toEqual(['Cloud hosting'])
    expect(await names('hosting figma')).toEqual([])
  })

  it('keeps the subscriptions with a payment still to come on active, and every other bill off it', async () => {
    const kit = await book.connect()

    book.add({ name: 'Running', recurrence: 'MONTHLY', paidOn: '2026-01-10' })
    book.add({ name: 'Ended', recurrence: 'MONTHLY', paidOn: '2025-01-10', endsOn: '2026-06-30' })
    book.add({ name: 'Once', paidOn: '2026-03-02' })
    // A subscription starting three years ahead, which pays nothing within two
    book.add({ name: 'Later', recurrence: 'MONTHLY', paidOn: '2029-06-01' })

    const names = async (filters: Record<string, unknown>) =>
      (await kit.answer<Page>('list_bills', filters)).bills.map(bill => bill.name).sort()

    expect(await names({ active: true })).toEqual(['Later', 'Running'])
    expect(await names({ active: false })).toEqual(['Ended', 'Once'])
    expect(await names({ recurring: true })).toEqual(['Ended', 'Later', 'Running'])
    expect(await names({ recurring: false })).toEqual(['Once'])
  })

  it('keeps the bills with a payment between two days, and those one member pays', async () => {
    const kit = await book.connect()

    fake.addMember('other', ORGANIZATION_ID)
    book.add({ name: 'Monthly', recurrence: 'MONTHLY', paidOn: '2026-01-10' })
    book.add({ name: 'March', paidOn: '2026-03-02', paidById: 'other' })
    book.add({ name: 'September', paidOn: '2026-09-02' })

    const names = async (filters: Record<string, unknown>) =>
      (await kit.answer<Page>('list_bills', filters)).bills.map(bill => bill.name).sort()

    expect(await names({ paidFrom: '2026-03-01', paidTo: '2026-03-05' })).toEqual(['March'])
    expect(await names({ paidFrom: '2026-03-01', paidTo: '2026-03-31' })).toEqual(['March', 'Monthly'])
    expect(await names({ paidFrom: '2026-09-01' })).toEqual(['Monthly', 'September'])
    // A start past the caller's ten years still finds a bill that keeps going
    expect(await names({ paidFrom: '2040-01-01' })).toEqual(['Monthly'])
    expect(await names({ paidBy: 'member:other' })).toEqual(['March'])
    expect(await names({ paidBy: 'me' })).toEqual(['Monthly', 'September'])
  })

  it("draws an external agent's query on the member's search allowance, and refuses it past it", async () => {
    const external = await book.connect({ kind: 'external', idempotencyScope: 'connection:checked' })

    book.add({ name: 'Figma' })

    await external.answer('list_bills', {})

    expect(fake.searches).toHaveLength(0)

    await external.answer('list_bills', { query: 'figma' })

    expect(fake.searches).toHaveLength(1)

    for (let index = 1; index < MAX_CONVERSATION_SEARCHES; index++) {
      fake.searches.push({ userId: 'member', organizationId: ORGANIZATION_ID, createdAt: new Date().toISOString() })
    }

    const refusal = await external.refusal('list_bills', { query: 'figma' })

    expect(refusal).toStartWith(`Searches as the member are limited to ${MAX_CONVERSATION_SEARCHES} in 10 minutes`)
    expect(refusal).toEndWith('or call list_bills without a query meanwhile.')
  })

  it("counts nothing of Strategy Dance's agent's query, and refuses a cursor it never gave", async () => {
    const kit = await book.connect()

    await kit.answer('list_bills', { query: 'figma' })

    expect(fake.searches).toHaveLength(0)
    expect(await kit.refusal('list_bills', { cursor: 'not-a-cursor' })).toBe(
      'That cursor is not one this tool gave. Start again without it.',
    )
  })
})
