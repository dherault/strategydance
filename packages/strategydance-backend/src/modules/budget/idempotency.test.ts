import { afterEach, describe, expect, it, mock } from 'bun:test'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createBudgetTestBills } = await import('./testing/createBudgetTestBills')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const book = createBudgetTestBills(fake, ORGANIZATION_ID)

const CONFLICT = 'That idempotency key was sent before with another call. Send a new key with each new call.'

const NOTION = { name: 'Notion', company: 'Notion Labs', amount: '10.00', currency: 'USD' }

afterEach(() => fake.reset())

describe('idempotency keys', () => {
  it('adds once under one key, the second call answered with the first result', async () => {
    const kit = await book.connect()
    const first = await kit.answer<{ id: string }>('add_bill', NOTION, 'key-1')
    const second = await kit.answer<{ id: string }>(
      'add_bill',
      { currency: 'USD', amount: '10.00', company: 'Notion Labs', name: 'Notion' },
      'key-1',
    )

    expect(second).toEqual(first)
    expect(fake.bills.size).toBe(1)
  })

  it('refuses a key sent again with other arguments, or to another tool with the same ones', async () => {
    const kit = await book.connect()
    const bill = book.add({ name: 'Figma' })

    await kit.answer('update_bill', { id: bill.id, name: 'Once' }, 'key-1')

    expect(await kit.refusal('update_bill', { id: bill.id, name: 'Twice' }, 'key-1')).toBe(CONFLICT)

    await kit.answer('delete_bill', { id: bill.id }, 'key-2')

    expect(await kit.refusal('restore_bill', { id: bill.id }, 'key-2')).toBe(CONFLICT)
    expect(fake.bills.get(bill.id)!.name).toBe('Once')
    expect(fake.bills.get(bill.id)!.deletedAt).not.toBeNull()
  })

  it('makes one write of two calls at once under one key', async () => {
    const kit = await book.connect()
    const [first, second] = await Promise.all([
      kit.answer<{ id: string }>('add_bill', NOTION, 'key-1'),
      kit.answer<{ id: string }>('add_bill', NOTION, 'key-1'),
    ])

    expect(second).toEqual(first)
    expect(fake.bills.size).toBe(1)
    expect(fake.results.size).toBe(1)
  })
})
