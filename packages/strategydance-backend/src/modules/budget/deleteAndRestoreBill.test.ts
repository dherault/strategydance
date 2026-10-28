import { afterEach, describe, expect, it, mock, setSystemTime } from 'bun:test'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createBudgetTestBills } = await import('./testing/createBudgetTestBills')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const book = createBudgetTestBills(fake, ORGANIZATION_ID)

afterEach(() => {
  fake.reset()
  setSystemTime()
})

describe('delete_bill and restore_bill', () => {
  it('delete a bill, keeping its receipt, and restore it within a day', async () => {
    const kit = await book.connect()
    const receipt = fake.insertReceipt({ organizationId: ORGANIZATION_ID, userId: 'member' })
    const bill = book.add({ name: 'Figma', receiptId: receipt.id })

    setSystemTime(new Date('2026-10-19T12:00:00Z'))

    expect(await kit.answer('delete_bill', { id: bill.id })).toEqual({
      id: bill.id,
      restorableUntil: '2026-10-20T12:00:00.000Z',
    })
    expect(await kit.refusal('read_bill', { id: bill.id })).toBe(
      'No bill has that id. List the bills to find it: a deleted bill is not listed.',
    )
    expect((await kit.answer<{ total: number }>('list_bills', {})).total).toBe(0)

    setSystemTime(new Date('2026-10-20T11:00:00Z'))

    expect(await kit.answer('restore_bill', { id: bill.id })).toMatchObject({
      id: bill.id,
      name: 'Figma',
      hasReceipt: true,
    })
    expect(fake.bills.get(bill.id)).toMatchObject({ deletedAt: null, receiptId: receipt.id })
  })

  it('refuses a restore past a day, a bill not deleted, and a delete of a bill gone already', async () => {
    const kit = await book.connect()
    const bill = book.add()

    setSystemTime(new Date('2026-10-19T12:00:00Z'))
    await kit.answer('delete_bill', { id: bill.id })

    expect(await kit.refusal('delete_bill', { id: bill.id })).toBe(
      'No bill has that id. List the bills to find it: a deleted bill is not listed.',
    )

    setSystemTime(new Date('2026-10-20T12:00:01Z'))

    expect(await kit.refusal('restore_bill', { id: bill.id })).toBe(
      'The bill was deleted over a day ago and is gone for good.',
    )

    const live = book.add()

    expect(await kit.refusal('restore_bill', { id: live.id })).toBe(
      'The bill is not deleted, so there is nothing to restore.',
    )
  })

  it('refuses a restore past the 2000 bills an organization keeps', async () => {
    const kit = await book.connect()
    const bill = book.add({ deletedAt: new Date().toISOString() })

    for (let index = 0; index < 2000; index++) book.add()

    expect(await kit.refusal('restore_bill', { id: bill.id })).toBe(
      'The organization keeps 2000 bills, the most it may. Tell the member, who can delete one first.',
    )
  })
})
