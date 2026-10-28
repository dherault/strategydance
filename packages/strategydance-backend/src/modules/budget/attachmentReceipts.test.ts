import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import type { ConversationRunReference, ModuleCaller } from '~types'

import buildBillReceiptObjectName from '~utils/buildBillReceiptObjectName'
import buildConversationStoragePrefix from '~utils/buildConversationStoragePrefix'

import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'
import createConversationDatabaseFake, {
  type FakeAttachment,
} from '~domain/conversations/testing/createConversationDatabaseFake'
import { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const storage = createAttachmentStorageFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/budget/billReceiptStorage', () => ({ default: storage.storage }))

const { default: createSubagentsTestConversation } =
  await import('~modules/subagents/testing/createSubagentsTestConversation')
const { default: createSubagentsCaller } = await import('~domain/subagents/testing/createSubagentsCaller')
const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')

const conversation = createSubagentsTestConversation(fake)

const NOTION = { name: 'Notion', company: 'Notion Labs', amount: '10.00', currency: 'USD' }
const BYTES = new TextEncoder().encode('%PDF-1.7 an invoice')

const NOT_FOUND =
  'No file the member sent in this conversation, nor one your brief hands you, has that id. Name a file by the id its line gives, as name (attachment <id>), or hand the receipt over as base64 or as text.'

// The Budget module as a claimed run of the conversation reaches it, its launcher
function connect(launching: ConversationRunReference, overrides: Partial<ModuleCaller> = {}) {
  return createModuleTestKit(
    'budget',
    createSubagentsCaller(fake, launching, { scopes: ['budget:read', 'budget:write'], ...overrides }),
  )
}

// A file of a conversation's, its bytes stored where a sent file's are
function sendFile(conversationId: string, values: Partial<FakeAttachment> = {}) {
  const file = conversation.insertAttachment(conversationId, {
    name: 'Invoice-2026-10.pdf',
    size: BYTES.length,
    ...values,
  })
  const prefix = buildConversationStoragePrefix({
    organizationId: ORGANIZATION_ID,
    userId: file.userId,
    conversationId: file.conversationId,
  })

  storage.objects.set(`${prefix}${file.id}`, { bytes: BYTES, contentType: file.contentType })

  return file
}

function readReceipt(billId: string) {
  const receiptId = fake.modules.bills.get(billId)?.receiptId

  return receiptId ? fake.modules.receipts.get(receiptId) : undefined
}

function readStoredReceipt(receiptId: string) {
  return storage.objects.get(buildBillReceiptObjectName({ organizationId: ORGANIZATION_ID, receiptId }))
}

beforeEach(() => {
  fake.addMember('author', ORGANIZATION_ID)
})

afterEach(() => {
  fake.reset()
  storage.objects.clear()
  storage.calls.length = 0
})

describe("a receipt by a conversation's file", () => {
  it('takes a file the member sent in the conversation calling, copied into the receipts as it is', async () => {
    const parent = await conversation.startRunning()
    const file = sendFile(parent.conversationId)
    const kit = await connect(parent)
    const added = await kit.answer('add_bill', { ...NOTION, receipt: { attachmentId: file.id } }, 'toolu_01')
    const receipt = readReceipt(added.id)

    expect(added.hasReceipt).toBe(true)
    expect(receipt).toMatchObject({
      status: 'READY',
      name: 'Invoice-2026-10.pdf',
      contentType: 'application/pdf',
      size: BYTES.length,
      userId: 'author',
    })
    expect(readStoredReceipt(receipt!.id)?.bytes).toEqual(BYTES)
    expect(storage.calls.filter(call => call.startsWith('read '))).toEqual([])
  })

  it('takes an id written with hyphens, as the agent may copy it', async () => {
    const parent = await conversation.startRunning()
    const file = sendFile(parent.conversationId)
    const kit = await connect(parent)
    const hyphenated = file.id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
    const added = await kit.answer('add_bill', { ...NOTION, receipt: { attachmentId: hyphenated } }, 'toolu_01')

    expect(readReceipt(added.id)?.name).toBe('Invoice-2026-10.pdf')
  })

  it("refuses a file of another of the member's conversations, and one waiting in a draft, writing nothing", async () => {
    const parent = await conversation.startRunning()
    const other = await conversation.kit.start('Another conversation')
    const elsewhere = sendFile(other.conversationId)
    const drafted = sendFile(parent.conversationId, { messageId: null })
    const kit = await connect(parent)

    expect(await kit.refusal('add_bill', { ...NOTION, receipt: { attachmentId: elsewhere.id } }, 'toolu_01')).toBe(
      NOT_FOUND,
    )
    expect(await kit.refusal('add_bill', { ...NOTION, receipt: { attachmentId: drafted.id } }, 'toolu_02')).toBe(
      NOT_FOUND,
    )
    expect(fake.modules.receipts.size).toBe(0)
    expect(fake.modules.bills.size).toBe(0)
  })

  it("takes a file a subagent's brief hands it, and refuses one of its parent's the brief does not list", async () => {
    const parent = await conversation.startRunning()
    const handed = sendFile(parent.conversationId)
    const kept = sendFile(parent.conversationId, { name: 'Other.pdf' })
    const subagent = await conversation.kit.launch(parent, { attachmentIds: [handed.id] })

    await conversation.kit.claim(subagent)

    const kit = await connect(subagent)
    const added = await kit.answer('add_bill', { ...NOTION, receipt: { attachmentId: handed.id } }, 'toolu_01')

    expect(readStoredReceipt(readReceipt(added.id)!.id)?.bytes).toEqual(BYTES)
    expect(await kit.refusal('add_bill', { ...NOTION, receipt: { attachmentId: kept.id } }, 'toolu_02')).toBe(NOT_FOUND)
  })

  it('refuses a GIF and a PDF past 20 pages on their rows, without reading them', async () => {
    const parent = await conversation.startRunning()
    const gif = sendFile(parent.conversationId, { name: 'receipt.gif', contentType: 'image/gif' })
    const long = sendFile(parent.conversationId, { pageCount: 21 })
    const kit = await connect(parent)

    expect(await kit.refusal('add_bill', { ...NOTION, receipt: { attachmentId: gif.id } }, 'toolu_01')).toBe(
      'A receipt is a PDF, a text or a JPEG, PNG or WebP photo, and this file is a GIF. Nothing was written.',
    )
    expect(await kit.refusal('add_bill', { ...NOTION, receipt: { attachmentId: long.id } }, 'toolu_02')).toBe(
      "A receipt's PDF has at most 20 pages. Nothing was written.",
    )
    expect(fake.modules.receipts.size).toBe(0)
    expect(storage.calls).toEqual([])
  })

  it('refuses a file named by a caller no run connected, as an external agent is', async () => {
    const parent = await conversation.startRunning()
    const file = sendFile(parent.conversationId)
    const kit = await connect(parent, { kind: 'external', idempotencyScope: 'connection:checked', launcher: undefined })

    expect(await kit.refusal('add_bill', { ...NOTION, receipt: { attachmentId: file.id } }, 'toolu_01')).toBe(
      'A receipt by attachmentId is a file the member sent in a conversation, which this connection has none of. Hand the receipt over as base64 or as text.',
    )
    expect(fake.calls).not.toContain('GetConversationAttachmentForAgent')
  })

  it('answers a call its key answered without reading the file again', async () => {
    const parent = await conversation.startRunning()
    const file = sendFile(parent.conversationId)
    const kit = await connect(parent)
    const args = { ...NOTION, receipt: { attachmentId: file.id } }
    const added = await kit.answer('add_bill', args, 'toolu_01')
    const reads = fake.calls.filter(name => name === 'GetConversationAttachmentForAgent').length

    expect(reads).toBe(1)
    expect(await kit.answer('add_bill', args, 'toolu_01')).toEqual(added)
    expect(fake.calls.filter(name => name === 'GetConversationAttachmentForAgent').length).toBe(reads)
    expect(fake.modules.receipts.size).toBe(1)
  })

  it('refuses a file pruned before its copy, its reservation left for the sweep', async () => {
    const parent = await conversation.startRunning()
    const file = conversation.insertAttachment(parent.conversationId, { name: 'Invoice-2026-10.pdf' })
    const kit = await connect(parent)

    expect(await kit.refusal('add_bill', { ...NOTION, receipt: { attachmentId: file.id } }, 'toolu_01')).toBe(NOT_FOUND)
    expect([...fake.modules.receipts.values()].map(({ status }) => status)).toEqual(['UPLOADING'])
    expect(fake.modules.bills.size).toBe(0)
  })

  it("replaces a bill's receipt with a file the member sent", async () => {
    const parent = await conversation.startRunning()
    const file = sendFile(parent.conversationId)
    const bill = fake.modules.insertBill({ organizationId: ORGANIZATION_ID, paidById: 'author' })
    const kit = await connect(parent)
    const updated = await kit.answer('update_bill', { id: bill.id, receipt: { attachmentId: file.id } }, 'toolu_01')

    expect(updated.hasReceipt).toBe(true)
    expect(readStoredReceipt(readReceipt(bill.id)!.id)?.bytes).toEqual(BYTES)
  })
})
