import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import {
  type BillReceiptFields,
  MAX_DAILY_RECEIPT_READS_PER_MEMBER,
  MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION,
} from 'strategydance-core'

import createClaudeMessage from '~domain/agent/createClaudeMessage'
import createScriptedClaudeClient from '~domain/agent/testing/createScriptedClaudeClient'
import { BILL_RECEIPT_READ_MODEL } from '~domain/budget/billReceiptReadSettings'
import createBudgetDatabaseFake from '~domain/budget/testing/createBudgetDatabaseFake'
import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'
import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'

const fake = createBudgetDatabaseFake(createModuleDatabaseFakeBase())
const storage = createAttachmentStorageFake()

mock.module('~firebase', () => ({ dataConnect: {}, bucket: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/budget/billReceiptStorage', () => ({ default: storage.storage }))
mock.module('~domain/agent/conversationClaudeClient', () => ({ default: createScriptedClaudeClient().client }))

const { default: requestBillReceiptRead } = await import('./requestBillReceiptRead')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const OTHER_ORGANIZATION_ID = '7a6b5c4d3e2f41a09b8c7d6e5f4a3b2c'
const MEMBER = 'member'
const OTHER = 'other'
const TODAY = '2026-10-27'
const HOUR_MS = 60 * 60 * 1000

const FIELDS: BillReceiptFields = {
  name: 'Figma Professional',
  description: 'Design seats for October',
  company: 'Figma',
  amount: '45.00',
  currency: 'USD',
  paidOn: '2026-10-03',
  recurrence: 'MONTHLY',
}

function answer(fields: unknown = FIELDS, stopReason: BetaStopReason = 'end_turn') {
  return createClaudeMessage({
    content: [{ type: 'text', text: JSON.stringify(fields), citations: null }],
    stopReason,
    model: BILL_RECEIPT_READ_MODEL,
    usage: { inputTokens: 1800, outputTokens: 90 },
  })
}

// A receipt the member uploaded, its file stored
function upload(
  fields: Parameters<typeof fake.insertReceipt>[0] = { organizationId: ORGANIZATION_ID, userId: MEMBER },
) {
  const receipt = fake.insertReceipt(fields)

  storage.objects.set(`organizations/${receipt.organizationId}/receipts/${receipt.id}`, {
    bytes: new TextEncoder().encode('%PDF-1.7 Figma invoice'),
    contentType: receipt.contentType,
  })

  return receipt
}

// Receipts read so many hours ago, the newest first, each a second older than the one before
function insertReads(count: number, { userId, hoursAgo }: { userId: string; hoursAgo: number }) {
  for (let index = 0; index < count; index++) {
    fake.insertReceipt({
      organizationId: ORGANIZATION_ID,
      userId,
      readAt: new Date(Date.now() - hoursAgo * HOUR_MS - index * 1000).toISOString(),
      readFields: JSON.stringify(FIELDS),
    })
  }
}

function read(receiptId: string, client = createScriptedClaudeClient().client, userId = MEMBER) {
  return requestBillReceiptRead({ organizationId: ORGANIZATION_ID, userId, receiptId, today: TODAY, client })
}

beforeEach(() => {
  fake.reset()
  storage.objects.clear()
  fake.addMember(MEMBER, ORGANIZATION_ID)
  fake.addMember(OTHER, ORGANIZATION_ID)
  fake.organizationNames.set(ORGANIZATION_ID, 'Acme Studio')
})

describe('requestBillReceiptRead', () => {
  test('reads a receipt once, keeps what it found, and answers it again for nothing', async () => {
    const receipt = upload()
    const scripted = createScriptedClaudeClient({ answers: [answer()] })

    expect(await read(receipt.id, scripted.client)).toEqual({ outcome: 'read', fields: FIELDS })
    expect(scripted.requests).toHaveLength(1)

    const [request] = scripted.readRequests()

    expect(request).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 1024 })
    expect(scripted.requests[0]).toContain('The company the receipt belongs to, which paid it: Acme Studio')
    expect(scripted.requests[0]).toContain(Buffer.from('%PDF-1.7 Figma invoice').toString('base64'))
    expect(fake.receipts.get(receipt.id)).toMatchObject({ readFields: JSON.stringify(FIELDS) })

    // A script with no answer left throws on any request
    expect(await read(receipt.id, scripted.client)).toEqual({ outcome: 'read', fields: FIELDS })
    expect(scripted.requests).toHaveLength(1)
  })

  test('refuses a caller who is no member, and another member’s receipt, before any request', async () => {
    const receipt = upload()

    expect(await read(receipt.id, undefined, 'outsider')).toEqual({ outcome: 'forbidden' })
    expect(await read(receipt.id, undefined, OTHER)).toEqual({ outcome: 'notUploader' })
    expect(fake.receipts.get(receipt.id)?.readAt).toBeNull()
  })

  test('finds no receipt of another organization, or one still uploading', async () => {
    fake.addMember(MEMBER, OTHER_ORGANIZATION_ID)

    const elsewhere = upload({ organizationId: OTHER_ORGANIZATION_ID, userId: MEMBER })
    const uploading = upload({ organizationId: ORGANIZATION_ID, userId: MEMBER, status: 'UPLOADING' })

    expect(await read(elsewhere.id)).toEqual({ outcome: 'missing' })
    expect(await read(uploading.id)).toEqual({ outcome: 'missing' })
    expect(await read(crypto.randomUUID())).toEqual({ outcome: 'missing' })
  })

  test('lets a refusal, an answer cut at its length and a failed request go, so it can be asked again', async () => {
    const receipt = upload()
    const scripted = createScriptedClaudeClient({
      answers: [
        answer(FIELDS, 'refusal'),
        answer({ name: 'Fig' }, 'max_tokens'),
        new Error('overloaded_error'),
        answer({ ...FIELDS, amount: '1,500.00' }),
      ],
    })

    for (let attempt = 0; attempt < 3; attempt++) {
      expect(await read(receipt.id, scripted.client)).toEqual({ outcome: 'failed' })
      expect(fake.receipts.get(receipt.id)).toMatchObject({ readAt: null, readFields: null })
    }

    expect(await read(receipt.id, scripted.client)).toEqual({ outcome: 'read', fields: { ...FIELDS, amount: null } })
  })

  test('answers a read under way as busy, and takes over one claimed over two minutes ago', async () => {
    const receipt = upload()

    fake.receipts.get(receipt.id)!.readAt = new Date(Date.now() - 60 * 1000).toISOString()

    expect(await read(receipt.id)).toEqual({ outcome: 'busy' })

    fake.receipts.get(receipt.id)!.readAt = new Date(Date.now() - 2 * 60 * 1000 - 1000).toISOString()

    const scripted = createScriptedClaudeClient({ answers: [answer()] })

    expect(await read(receipt.id, scripted.client)).toEqual({ outcome: 'read', fields: FIELDS })
  })

  test('holds the member to 50 reads in 24 hours, saying when the next fits, with no request', async () => {
    const receipt = upload()

    insertReads(MAX_DAILY_RECEIPT_READS_PER_MEMBER, { userId: MEMBER, hoursAgo: 1 })

    const result = await read(receipt.id)

    expect(result).toMatchObject({ outcome: 'capped', cap: { kind: 'receiptReads', scope: 'member', max: 50 } })

    // The 50th newest read, 49 seconds older than an hour ago, frees its place 23 hours on
    const retryAfterMs = result.outcome === 'capped' ? result.cap.retryAfterMs : 0

    expect(Math.abs(retryAfterMs - (23 * HOUR_MS - 49 * 1000))).toBeLessThan(5000)
    expect(fake.receipts.get(receipt.id)?.readAt).toBeNull()
  })

  test('holds the organization to 200 reads in 24 hours, whoever asked', async () => {
    const receipt = upload()

    insertReads(MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION, { userId: OTHER, hoursAgo: 2 })

    expect(await read(receipt.id)).toMatchObject({
      outcome: 'capped',
      cap: { kind: 'receiptReads', scope: 'organization', max: 200 },
    })
  })

  test('counts a read 24 hours old no more, nor a read that failed', async () => {
    const receipt = upload()

    insertReads(MAX_DAILY_RECEIPT_READS_PER_MEMBER, { userId: MEMBER, hoursAgo: 24.01 })
    upload({ organizationId: ORGANIZATION_ID, userId: MEMBER, readAt: null })

    const scripted = createScriptedClaudeClient({ answers: [answer()] })

    expect(await read(receipt.id, scripted.client)).toEqual({ outcome: 'read', fields: FIELDS })
  })

  test('refuses a photo past what Claude reads before anything is claimed', async () => {
    const receipt = upload({
      organizationId: ORGANIZATION_ID,
      userId: MEMBER,
      contentType: 'image/png',
      size: 4 * 1024 * 1024,
    })

    expect(await read(receipt.id)).toEqual({ outcome: 'tooLarge' })
    expect(fake.receipts.get(receipt.id)?.readAt).toBeNull()
  })
})
