import { beforeEach, describe, expect, mock, test } from 'bun:test'

import createBudgetDatabaseFake from '~domain/budget/testing/createBudgetDatabaseFake'
import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'
import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'

const fake = createBudgetDatabaseFake(createModuleDatabaseFakeBase())
const storage = createAttachmentStorageFake()

mock.module('~firebase', () => ({ dataConnect: {}, bucket: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/budget/billReceiptStorage', () => ({ default: storage.storage }))

const { default: pruneBillReceipts } = await import('./pruneBillReceipts')
const { default: pruneDeletedBills } = await import('./pruneDeletedBills')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const MEMBER = 'member'

const HOUR_MS = 60 * 60 * 1000

// A stored receipt, uploaded so many hours ago, with its file in the bucket
function upload(hoursAgo: number) {
  const receipt = fake.insertReceipt({
    organizationId: ORGANIZATION_ID,
    userId: MEMBER,
    createdAt: new Date(Date.now() - hoursAgo * HOUR_MS).toISOString(),
  })

  storage.objects.set(objectName(receipt.id), { bytes: new Uint8Array(1000), contentType: 'application/pdf' })

  return receipt
}

function objectName(receiptId: string) {
  return `organizations/${ORGANIZATION_ID}/receipts/${receiptId}`
}

beforeEach(() => {
  fake.reset()
  storage.objects.clear()
  storage.calls.length = 0
})

describe('pruneBillReceipts', () => {
  test('deletes a receipt no bill holds three days after its upload, its file before its row', async () => {
    const old = upload(73)
    const recent = upload(71)
    let isFileGoneBeforeRow = false

    fake.beforeOperation = async name => {
      if (name === 'DeleteBillReceipts') isFileGoneBeforeRow = !storage.objects.has(objectName(old.id))
    }

    expect(await pruneBillReceipts()).toEqual({ deleted: 1, kept: 0 })
    expect(isFileGoneBeforeRow).toBe(true)
    expect(fake.receipts.has(old.id)).toBe(false)
    expect(storage.objects.has(objectName(old.id))).toBe(false)
    expect(fake.receipts.has(recent.id)).toBe(true)
    expect(storage.objects.has(objectName(recent.id))).toBe(true)
  })

  test('keeps a receipt a bill holds, a deleted one included, until the sweep prunes the bill', async () => {
    const held = upload(100)
    const ofDeleted = upload(100)
    const bill = fake.insertBill({
      organizationId: ORGANIZATION_ID,
      receiptId: ofDeleted.id,
      deletedAt: new Date(Date.now() - 2 * HOUR_MS).toISOString(),
    })

    fake.insertBill({ organizationId: ORGANIZATION_ID, receiptId: held.id })

    expect(await pruneBillReceipts()).toEqual({ deleted: 0, kept: 0 })

    // Past its Undo, the bill goes, and its receipt in the same sweep
    bill.deletedAt = new Date(Date.now() - 25 * HOUR_MS).toISOString()

    expect(await pruneDeletedBills()).toEqual({ deleted: 1 })
    expect(await pruneBillReceipts()).toEqual({ deleted: 1, kept: 0 })
    expect(fake.receipts.has(ofDeleted.id)).toBe(false)
    expect(fake.receipts.has(held.id)).toBe(true)
  })

  test("keeps a bill's earlier receipts while the bill lasts, and takes them with it", async () => {
    const bill = fake.insertBill({ organizationId: ORGANIZATION_ID, receiptId: upload(100).id })
    const earlier = upload(100)

    earlier.formerBillId = bill.id

    expect(await pruneBillReceipts()).toEqual({ deleted: 0, kept: 0 })

    bill.deletedAt = new Date(Date.now() - 25 * HOUR_MS).toISOString()

    expect(await pruneDeletedBills()).toEqual({ deleted: 1 })
    expect(await pruneBillReceipts()).toEqual({ deleted: 2, kept: 0 })
    expect(fake.receipts.has(earlier.id)).toBe(false)
    expect(storage.objects.has(objectName(earlier.id))).toBe(false)
  })

  test('keeps a receipt whose file could not be deleted, for the next sweep', async () => {
    const old = upload(73)

    storage.failures.delete = [new Error('Storage is down')]

    expect(await pruneBillReceipts()).toEqual({ deleted: 0, kept: 1 })
    expect(fake.receipts.has(old.id)).toBe(true)
    expect(await pruneBillReceipts()).toEqual({ deleted: 1, kept: 0 })
    expect(fake.receipts.has(old.id)).toBe(false)
  })

  test('goes through more receipts than one batch holds', async () => {
    for (let index = 0; index < 150; index++) upload(96)

    expect(await pruneBillReceipts()).toEqual({ deleted: 150, kept: 0 })
    expect(storage.objects.size).toBe(0)
  })
})
