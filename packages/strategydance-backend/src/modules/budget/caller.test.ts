import { afterEach, describe, expect, it, mock } from 'bun:test'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createBudgetTestBills } = await import('./testing/createBudgetTestBills')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const book = createBudgetTestBills(fake, ORGANIZATION_ID)

const NOT_MEMBER = 'The member is no longer in this organization, so its budget is closed to you.'

afterEach(() => fake.reset())

// A call to each write tool, with what it names
function writes(billId: string) {
  return [
    ['add_bill', { name: 'Notion', company: 'Notion Labs', amount: '10.00', currency: 'USD' }],
    ['update_bill', { id: billId, name: 'Renamed' }],
    ['delete_bill', { id: billId }],
    ['restore_bill', { id: billId }],
  ] as const
}

describe('the caller', () => {
  it('challenges every write of a caller without the write scope, still listing it, before anything is read or written', async () => {
    const kit = await book.connect({
      kind: 'external',
      scopes: ['budget:read'],
      idempotencyScope: 'connection:checked',
    })
    const bill = book.add()

    fake.calls.length = 0

    expect((await kit.client.listTools()).tools.map(tool => tool.name)).toEqual([
      'read_budget',
      'list_bills',
      'read_bill',
      'add_bill',
      'update_bill',
      'delete_bill',
      'restore_bill',
    ])

    for (const [name, args] of writes(bill.id)) {
      await expect(kit.call(name, args)).rejects.toMatchObject({
        name: 'InsufficientScopeError',
        requiredScope: 'budget:write',
      })
    }

    expect(fake.calls).toEqual([])
    expect((await kit.answer<{ total: number }>('list_bills', {})).total).toBe(1)
  })

  it('refuses every call of a removed member, writing nothing', async () => {
    const kit = await book.connect()
    const bill = book.add({ name: 'Figma' })

    fake.removeMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('read_budget', {})).toBe(NOT_MEMBER)
    expect(await kit.refusal('list_bills', {})).toBe(NOT_MEMBER)
    expect(await kit.refusal('list_bills', { query: 'figma' })).toBe(NOT_MEMBER)
    expect(await kit.refusal('read_bill', { id: bill.id })).toBe(NOT_MEMBER)

    for (const [name, args] of writes(bill.id)) expect(await kit.refusal(name, args)).toBe(NOT_MEMBER)

    expect(fake.bills.get(bill.id)!.name).toBe('Figma')
    expect(fake.bills.get(bill.id)!.deletedAt).toBeNull()
    expect(fake.bills.size).toBe(1)
  })

  it('refuses a call carrying the membership of a member since removed and invited back', async () => {
    const kit = await book.connect()
    const bill = book.add({ name: 'Figma' })

    fake.removeMember('member', ORGANIZATION_ID)
    fake.addMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('read_bill', { id: bill.id })).toBe(NOT_MEMBER)
    expect(await kit.refusal('update_bill', { id: bill.id, name: 'Renamed' })).toBe(NOT_MEMBER)
    expect(fake.bills.get(bill.id)!.name).toBe('Figma')
  })

  it('gives an external caller the web address of each bill, by the slug of its organization or its id, and the agent none', async () => {
    const agent = await book.connect()
    const bill = book.add()

    expect(await agent.answer('read_bill', { id: bill.id })).not.toHaveProperty('url')
    expect((await agent.answer<{ bills: object[] }>('list_bills', {})).bills[0]).not.toHaveProperty('url')

    const external = await book.connect({ kind: 'external', idempotencyScope: 'connection:checked' })

    expect((await external.answer('read_bill', { id: bill.id })).url).toBe(
      `http://localhost:5173/${ORGANIZATION_ID}/budget/${bill.id}`,
    )

    fake.organizations.get(ORGANIZATION_ID)!.slug = 'acme-studio-x7k2'

    const added = await external.answer<{ id: string; url: string }>('add_bill', {
      name: 'Notion',
      company: 'Notion Labs',
      amount: '10.00',
      currency: 'USD',
    })

    expect(added.url).toBe(`http://localhost:5173/acme-studio-x7k2/budget/${added.id}`)
  })

  it('answers a write that went through without its address when the organization cannot be read', async () => {
    const external = await book.connect({ kind: 'external', idempotencyScope: 'connection:checked' })

    fake.beforeOperation = async name => {
      if (name === 'GetOrganizationForAgent') throw new Error('connection reset')
    }

    const added = await external.answer<{ id: string; url?: string }>('add_bill', {
      name: 'Notion',
      company: 'Notion Labs',
      amount: '10.00',
      currency: 'USD',
    })

    expect(added).not.toHaveProperty('url')
    expect(fake.bills.has(added.id)).toBe(true)
  })
})
