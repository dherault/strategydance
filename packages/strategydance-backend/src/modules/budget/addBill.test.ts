import { afterEach, beforeEach, describe, expect, it, mock, setSystemTime } from 'bun:test'

import { PDFDocument } from 'pdf-lib'

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

const NOTION = { name: 'Notion', company: 'Notion Labs', amount: '10.00', currency: 'USD' }

// A PNG's signature, which is all the module reads of a photo
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

async function createPdf() {
  const document = await PDFDocument.create()

  document.addPage()

  return Buffer.from(await document.save()).toString('base64')
}

beforeEach(() => setSystemTime(new Date('2026-10-19T12:00:00Z')))

afterEach(() => {
  fake.reset()
  storage.objects.clear()
  setSystemTime()
})

describe('add_bill', () => {
  it("adds a bill paid today by the caller, unless told otherwise, as the member's agent wrote it", async () => {
    const kit = await book.connect()
    const added = await kit.answer('add_bill', { ...NOTION, recurrence: 'MONTHLY', description: 'Team wiki' })
    const bill = fake.bills.get(added.id)!

    expect(added).toMatchObject({
      name: 'Notion',
      description: 'Team wiki',
      company: 'Notion Labs',
      amount: '10.00',
      currency: 'USD',
      paidOn: '2026-10-19',
      recurrence: 'MONTHLY',
      endsOn: null,
      paidBy: 'member:member',
      paidByName: 'Ada',
      hasReceipt: false,
      lastPayment: { day: '2026-10-19', convertedAmount: '10.00' },
      nextPayment: { day: '2026-11-19', convertedAmount: '10.00' },
      isActive: true,
      budgetCurrency: 'USD',
      status: null,
    })
    expect(bill).toMatchObject({ amountMinor: 1000, paidById: 'member', createdById: 'member', receiptId: null })
  })

  it('names another member as its payer, and refuses somebody who is not one, writing nothing', async () => {
    const kit = await book.connect()

    fake.addMember('other', ORGANIZATION_ID, { displayName: 'Grace' })

    expect(await kit.answer('add_bill', { ...NOTION, paidBy: 'member:other' })).toMatchObject({
      paidBy: 'member:other',
      paidByName: 'Grace',
    })
    expect(await kit.refusal('add_bill', { ...NOTION, paidBy: 'member:stranger' })).toBe(
      'That person is not a member of the organization. Name a member as member:<id>, as a bill lists its payer, or "me".',
    )
    expect(fake.bills.size).toBe(1)
  })

  it('refuses an amount with more decimals than its currency has, or none at all, writing nothing', async () => {
    const kit = await book.connect()

    expect(await kit.refusal('add_bill', { ...NOTION, amount: '10.005' })).toBe(
      '"10.005" is not an amount in USD, which takes digits with at most 2 decimals after a point, as "312.40", and no sign, separator or symbol.',
    )
    expect(await kit.refusal('add_bill', { ...NOTION, amount: '1500.5', currency: 'JPY' })).toBe(
      '"1500.5" is not an amount in JPY, which takes digits with no decimals, as "1500", and no sign, separator or symbol.',
    )
    expect(await kit.refusal('add_bill', { ...NOTION, amount: '1,500.00' })).toContain('is not an amount in USD')
    expect(await kit.refusal('add_bill', { ...NOTION, amount: '0' })).toBe('An amount is more than 0.')
    expect(fake.bills.size).toBe(0)
  })

  it('refuses a name or a company on more than one line, a line separator included, writing nothing', async () => {
    const kit = await book.connect()

    expect(await kit.refusal('add_bill', { ...NOTION, name: 'Notion\nPlus' })).toContain('A name is one line')
    expect(await kit.refusal('add_bill', { ...NOTION, company: 'Notion\u2028Labs' })).toContain('A company is one line')
    expect(fake.bills.size).toBe(0)
  })

  it('refuses an end on a bill that does not recur, or before its first payment', async () => {
    const kit = await book.connect()

    expect(await kit.refusal('add_bill', { ...NOTION, endsOn: '2027-01-01' })).toBe(
      'Only a bill that recurs ends: give it a recurrence, or no endsOn.',
    )
    expect(
      await kit.refusal('add_bill', { ...NOTION, recurrence: 'MONTHLY', paidOn: '2026-10-01', endsOn: '2026-09-30' }),
    ).toBe('A bill ends on or after its first payment, paidOn.')
    expect(await kit.refusal('add_bill', { ...NOTION, paidOn: '1998-12-31' })).toBe(
      'A bill is first paid from 1999-01-01 to 2036-10-18.',
    )
  })

  it('keeps a text receipt as text/plain, stored where the bill holds it', async () => {
    const kit = await book.connect()
    const added = await kit.answer('add_bill', {
      ...NOTION,
      receipt: { name: 'Notion invoice.txt', text: 'Notion Labs\nTotal: $10.00' },
    })
    const bill = fake.bills.get(added.id)!
    const receipt = fake.receipts.get(bill.receiptId!)!

    expect(added.hasReceipt).toBe(true)
    expect(receipt).toMatchObject({
      name: 'Notion invoice.txt',
      contentType: 'text/plain',
      status: 'READY',
      userId: 'member',
    })

    const [stored] = [...storage.objects.values()]

    expect(new TextDecoder().decode(stored!.bytes)).toBe('Notion Labs\nTotal: $10.00')
    expect(stored!.contentType).toBe('text/plain')
  })

  it('keeps a PDF and a photo handed over in base64', async () => {
    const kit = await book.connect()
    const pdf = await kit.answer('add_bill', {
      ...NOTION,
      receipt: { name: 'Invoice.pdf', contentType: 'application/pdf', base64: await createPdf() },
    })
    const photo = await kit.answer('add_bill', {
      ...NOTION,
      receipt: { name: 'Receipt.png', contentType: 'image/png', base64: Buffer.from(PNG).toString('base64') },
    })

    expect(fake.receipts.get(fake.bills.get(pdf.id)!.receiptId!)!.contentType).toBe('application/pdf')
    expect(fake.receipts.get(fake.bills.get(photo.id)!.receiptId!)!.contentType).toBe('image/png')
    expect(storage.objects.size).toBe(2)
  })

  it('refuses a receipt past 700 KiB once decoded, writing nothing', async () => {
    const kit = await book.connect()
    const bytes = Buffer.concat([Buffer.from(PNG), Buffer.alloc(701 * 1024 - PNG.length)])

    expect(
      await kit.refusal('add_bill', {
        ...NOTION,
        receipt: { name: 'Receipt.png', contentType: 'image/png', base64: bytes.toString('base64') },
      }),
    ).toBe(
      'A receipt an agent hands over is at most 700 KiB once decoded, and this one is 701 KiB: the member can upload it on the Budget page instead. Nothing was written.',
    )
    expect(fake.bills.size).toBe(0)
    expect(fake.receipts.size).toBe(0)
    expect(storage.objects.size).toBe(0)
  })

  it('refuses base64 whose bytes are not the type it names, and a PDF its parser cannot read, writing nothing', async () => {
    const kit = await book.connect()

    expect(
      await kit.refusal('add_bill', {
        ...NOTION,
        receipt: { name: 'Receipt.png', contentType: 'image/png', base64: await createPdf() },
      }),
    ).toBe("The receipt's bytes are not image/png. Nothing was written.")
    expect(
      await kit.refusal('add_bill', {
        ...NOTION,
        receipt: {
          name: 'Invoice.pdf',
          contentType: 'application/pdf',
          base64: Buffer.from('%PDF-1.7 broken').toString('base64'),
        },
      }),
    ).toBe('The PDF cannot be read. Nothing was written.')
    expect(fake.bills.size).toBe(0)
    expect(fake.receipts.size).toBe(0)
  })

  it("refuses a conversation's file from a caller no run connected", async () => {
    const kit = await book.connect()
    const attachmentId = '7d4e2a9c1b8f4e3a9c6d5b4a3f2e1d0c'

    expect(await kit.refusal('add_bill', { ...NOTION, receipt: { attachmentId } })).toBe(
      'A receipt by attachmentId is a file the member sent in a conversation, which this connection has none of. Hand the receipt over as base64 or as text.',
    )
  })

  it('answers the budget over once the bill tips the month past its limit', async () => {
    const kit = await book.connect()

    fake.setBudget(ORGANIZATION_ID, { currency: 'USD', amountMinor: 10000, period: 'MONTHLY' })
    book.add({ name: 'Hosting', amountMinor: 9000, paidOn: '2026-10-02' })

    expect((await kit.answer('add_bill', NOTION)).status).toBeNull()
    expect((await kit.answer('add_bill', { ...NOTION, amount: '5.00' })).status).toEqual({
      level: 'over',
      scope: 'month',
      by: '5.00',
      limit: '100.00',
      expected: '0.00',
    })
  })

  it('refuses a bill past the 2000 an organization keeps', async () => {
    const kit = await book.connect()

    for (let index = 0; index < 2000; index++) book.add()

    expect(await kit.refusal('add_bill', NOTION)).toBe(
      'The organization keeps 2000 bills, the most it may. Tell the member, who can delete one first.',
    )
  })
})
