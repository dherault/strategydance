import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { Readable } from 'node:stream'

import { MAX_BILL_RECEIPT_SIZE } from 'strategydance-core'

import createBudgetDatabaseFake from '~domain/budget/testing/createBudgetDatabaseFake'
import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'
import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'

const fake = createBudgetDatabaseFake(createModuleDatabaseFakeBase())
const storage = createAttachmentStorageFake()

mock.module('~firebase', () => ({ dataConnect: {}, bucket: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/budget/billReceiptStorage', () => ({ default: storage.storage }))

const { default: uploadBillReceipt } = await import('./uploadBillReceipt')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const MEMBER = 'member'

beforeEach(() => {
  fake.reset()
  storage.objects.clear()
  fake.addMember(MEMBER, ORGANIZATION_ID)
})

/*
  A browser always sends the length of what it sends, which a route test's `fetch` sets for it, so
  only a body called directly can carry more than it declared, as a client lying about its length
  would
*/
describe('uploadBillReceipt', () => {
  test('cuts off a body past the size it declared, the 10 MiB at most, and leaves its row to the sweep', async () => {
    const receiptId = crypto.randomUUID().replaceAll('-', '')
    const bytes = Buffer.alloc(MAX_BILL_RECEIPT_SIZE + 1, 'a')
    const result = await uploadBillReceipt({
      organizationId: ORGANIZATION_ID,
      userId: MEMBER,
      receiptId,
      name: 'Receipt.txt',
      contentType: 'text/plain',
      size: MAX_BILL_RECEIPT_SIZE,
      body: Readable.from([bytes.subarray(0, MAX_BILL_RECEIPT_SIZE), bytes.subarray(MAX_BILL_RECEIPT_SIZE)]),
    })

    expect(result.outcome).toBe('tooLarge')
    expect(storage.objects.size).toBe(0)
    expect(fake.receipts.get(receiptId)?.status).toBe('UPLOADING')
  })
})
