import { afterEach, beforeEach, describe, expect, it, mock, setSystemTime } from 'bun:test'

import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'
import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()
const storage = createAttachmentStorageFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/budget/billReceiptStorage', () => ({ default: storage.storage }))

const { default: createBudgetTestBills } = await import('./testing/createBudgetTestBills')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const book = createBudgetTestBills(fake, ORGANIZATION_ID)

beforeEach(() => setSystemTime(new Date('2026-10-19T12:00:00Z')))

afterEach(() => {
  fake.reset()
  storage.objects.clear()
  setSystemTime()
})

describe('update_bill', () => {
  it('changes the fields it names and keeps the rest', async () => {
    const kit = await book.connect()
    const bill = book.add({ name: 'Figma', description: 'Design', amountMinor: 1500, recurrence: 'MONTHLY' })

    expect(await kit.answer('update_bill', { id: bill.id, amount: '18.00' })).toMatchObject({
      id: bill.id,
      name: 'Figma',
      description: 'Design',
      amount: '18.00',
      recurrence: 'MONTHLY',
    })
    expect(fake.bills.get(bill.id)).toMatchObject({ name: 'Figma', description: 'Design', amountMinor: 1800 })
  })

  it('names the member the agent acts as who saved the bill last, beside who added it', async () => {
    const kit = await book.connect()
    const bill = book.add({ name: 'Figma', createdById: 'other', updatedById: 'other' })

    await kit.answer('update_bill', { id: bill.id, amount: '18.00' })

    expect(fake.bills.get(bill.id)).toMatchObject({ createdById: 'other', updatedById: 'member' })
    expect(await kit.answer('read_bill', { id: bill.id })).toMatchObject({
      createdBy: 'member:other',
      updatedBy: 'member:member',
    })
  })

  it("keeps both a member's save landing in between and its own, reading the bill again and applying its fields again", async () => {
    const kit = await book.connect()
    const bill = book.add({ name: 'Figma', company: 'Figma', amountMinor: 1500 })
    let hasSaved = false

    fake.beforeOperation = async name => {
      if (name !== 'UpdateBillForAgent' || hasSaved) return

      hasSaved = true
      fake.changeBill(bill.id, { company: 'Figma Inc.' })
    }

    expect(await kit.answer('update_bill', { id: bill.id, amount: '18.00' })).toMatchObject({
      company: 'Figma Inc.',
      amount: '18.00',
    })
    expect(fake.bills.get(bill.id)).toMatchObject({ company: 'Figma Inc.', amountMinor: 1800 })
  })

  it("reads the bill again when a member's save moves a payer or a receipt the call kept, rather than refuse it", async () => {
    const kit = await book.connect()
    const receipt = fake.insertReceipt({
      organizationId: ORGANIZATION_ID,
      userId: 'other',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const bill = book.add({ paidById: 'former', receiptId: receipt.id, amountMinor: 1500 })
    let hasSaved = false

    fake.beforeOperation = async name => {
      if (name !== 'UpdateBillForAgent' || hasSaved) return

      hasSaved = true
      fake.changeBill(bill.id, { paidById: 'member', receiptId: null })
    }

    expect(await kit.answer('update_bill', { id: bill.id, amount: '18.00' })).toMatchObject({
      amount: '18.00',
      paidBy: 'member:member',
      hasReceipt: false,
    })
    expect(fake.bills.get(bill.id)).toMatchObject({ amountMinor: 1800, paidById: 'member', receiptId: null })
  })

  it('refuses a change held to a version a member saved over, writing nothing', async () => {
    const kit = await book.connect()
    const bill = book.add({ name: 'Figma', amountMinor: 1500 })
    const { version } = await kit.answer('read_bill', { id: bill.id })

    fake.changeBill(bill.id, { name: 'Figma Pro' })

    expect(await kit.refusal('update_bill', { id: bill.id, version, amount: '18.00' })).toBe(
      'The bill changed since you read it. Read it again first.',
    )
    expect(fake.bills.get(bill.id)).toMatchObject({ name: 'Figma Pro', amountMinor: 1500 })

    const { version: current } = await kit.answer('read_bill', { id: bill.id })

    expect(await kit.answer('update_bill', { id: bill.id, version: current, amount: '18.00' })).toMatchObject({
      name: 'Figma Pro',
      amount: '18.00',
    })
  })

  it('detaches the receipt on null, and replaces it with a new one, keeping each as an earlier receipt', async () => {
    const kit = await book.connect()
    const receipt = fake.insertReceipt({ organizationId: ORGANIZATION_ID, userId: 'member' })
    const bill = book.add({ receiptId: receipt.id })

    expect((await kit.answer('update_bill', { id: bill.id, receipt: null })).hasReceipt).toBe(false)
    expect(fake.bills.get(bill.id)!.receiptId).toBeNull()
    expect(fake.receipts.get(receipt.id)!.formerBillId).toBe(bill.id)

    const replaced = await kit.answer('update_bill', {
      id: bill.id,
      receipt: { name: 'Invoice.txt', text: 'Figma, $15.00' },
    })
    const replacement = fake.receipts.get(fake.bills.get(bill.id)!.receiptId!)!

    expect(replaced.hasReceipt).toBe(true)
    expect(replacement.name).toBe('Invoice.txt')

    await kit.answer('update_bill', { id: bill.id, receipt: null })

    expect(replacement.formerBillId).toBe(bill.id)
  })

  it("takes back one of the bill's earlier receipts by its id, and refuses any other", async () => {
    const kit = await book.connect()
    const kept = fake.insertReceipt({ organizationId: ORGANIZATION_ID, userId: 'other', name: 'March.pdf' })
    const current = fake.insertReceipt({ organizationId: ORGANIZATION_ID, userId: 'member' })
    // The caller's own and fresh, which another bill keeps, so no bill but that one takes it
    const elsewhere = fake.insertReceipt({ organizationId: ORGANIZATION_ID, userId: 'member' })
    const bill = book.add({ receiptId: current.id })
    const other = book.add({ receiptId: null })

    kept.formerBillId = bill.id
    elsewhere.formerBillId = other.id

    expect((await kit.answer('read_bill', { id: bill.id })).earlierReceipts).toEqual([
      { id: kept.id, name: 'March.pdf', contentType: 'application/pdf', size: 1000 },
    ])
    expect(await kit.refusal('update_bill', { id: bill.id, receipt: { earlierReceiptId: elsewhere.id } })).toBe(
      "That id is none of the bill's earlier receipts. Read the bill: read_bill lists them under earlierReceipts.",
    )
    expect(await kit.answer('update_bill', { id: bill.id, receipt: { earlierReceiptId: kept.id } })).toMatchObject({
      hasReceipt: true,
    })
    expect(fake.bills.get(bill.id)!.receiptId).toBe(kept.id)
    expect((await kit.answer('read_bill', { id: bill.id })).earlierReceipts).toEqual([
      { id: current.id, name: 'Invoice.pdf', contentType: 'application/pdf', size: 1000 },
    ])
  })

  it("keeps a day past the caller's ten years that another member's today took, holding a new one to them", async () => {
    const kit = await book.connect()
    // A day after the caller's last, 2036-10-18 on their 2026-10-19
    const bill = book.add({ paidOn: '2036-10-19' })

    expect(await kit.answer('update_bill', { id: bill.id, name: 'Renamed' })).toMatchObject({ paidOn: '2036-10-19' })
    expect(await kit.refusal('update_bill', { id: bill.id, paidOn: '2036-10-19' })).toBe(
      'A bill is first paid from 1999-01-01 to 2036-10-18.',
    )
  })

  it('takes its end off with its recurrence, and refuses a currency its amount does not fit', async () => {
    const kit = await book.connect()
    const bill = book.add({ amountMinor: 1234, recurrence: 'MONTHLY', paidOn: '2026-01-01', endsOn: '2026-12-31' })

    expect(await kit.answer('update_bill', { id: bill.id, recurrence: null })).toMatchObject({
      recurrence: null,
      endsOn: null,
    })
    expect(await kit.refusal('update_bill', { id: bill.id, currency: 'JPY' })).toBe(
      '"12.34" is not an amount in JPY, which takes digits with no decimals, as "1500", and no sign, separator or symbol.',
    )
    expect(await kit.answer('update_bill', { id: bill.id, currency: 'JPY', amount: '1900' })).toMatchObject({
      amount: '1900',
      currency: 'JPY',
    })
  })

  it('keeps the payer a bill has, even one who has left, and refuses a new one who is not a member', async () => {
    const kit = await book.connect()
    const bill = book.add({ paidById: 'former' })

    fake.setName('former', 'Linus')

    expect(await kit.answer('update_bill', { id: bill.id, name: 'Renamed' })).toMatchObject({
      paidBy: 'member:former',
      paidByName: 'Linus',
    })
    expect(await kit.refusal('update_bill', { id: bill.id, paidBy: 'member:stranger' })).toBe(
      'That person is not a member of the organization. Name a member as member:<id>, as a bill lists its payer, or "me".',
    )
  })

  it('refuses a call naming nothing to change, and a bill deleted', async () => {
    const kit = await book.connect()
    const bill = book.add({ deletedAt: new Date().toISOString() })

    expect(await kit.refusal('update_bill', { id: bill.id })).toContain('Name at least one of')
    expect(await kit.refusal('update_bill', { id: bill.id, name: 'Renamed' })).toBe(
      'No bill has that id. List the bills to find it: a deleted bill is not listed.',
    )
  })
})
