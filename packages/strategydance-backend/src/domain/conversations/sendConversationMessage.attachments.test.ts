import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { MessageCountTokensParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import createClaudeMessage from '~domain/agent/createClaudeMessage'
import createScriptedClaudeClient from '~domain/agent/testing/createScriptedClaudeClient'
import {
  parseConversationRunUsage,
  reserveConversationRequest,
  settleConversationRequest,
} from '~domain/conversations/conversationRunUsage'
import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'
import createConversationDatabaseFake, {
  type FakeAttachment,
} from '~domain/conversations/testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()
const storage = createAttachmentStorageFake()

/*
  A count endpoint whose system prompt and tools take 1000 tokens, and each character of text one,
  a dot included, so a test reads what was counted off the number
*/
function count(body: MessageCountTokensParams) {
  const characters = body.messages.reduce((total, message) => {
    if (typeof message.content === 'string') return total + message.content.length

    return total + message.content.reduce((sum, block) => sum + (block.type === 'text' ? block.text.length : 0), 0)
  }, 0)

  return (body.system ? 1000 : 0) + characters
}

const scripted = createScriptedClaudeClient({ count })

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/conversationAttachmentStorage', () => ({ default: storage.storage }))

mock.module('~domain/agent/conversationClaudeClient', () => ({ default: scripted.client }))

// The modules list no tool here, so the tools a send counts are the agent's own
mock.module('~domain/agent/connectConversationModules', () => ({
  default: async () => ({ tools: [], runners: [], close: async () => {} }),
}))

mock.module('~domain/conversations/enqueueRun', () => ({ default: async () => true }))

const { default: sendConversationMessage } = await import('./sendConversationMessage')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const AUTHOR = 'author'
const OTHER = 'other'

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

let conversationId = createId()
let clock = 0

// A file uploaded and ready to send, its pending object stored, each a moment after the one before
function upload(attachment: Partial<FakeAttachment> = {}) {
  const id = attachment.id ?? createId()

  clock += 1

  const row: FakeAttachment = {
    id,
    userId: AUTHOR,
    organizationId: ORGANIZATION_ID,
    conversationId,
    messageId: null,
    status: 'READY',
    name: 'Board.png',
    contentType: 'image/png',
    size: 1000,
    pageCount: null,
    tokenCount: 371,
    claudeFileId: `file_${id}`,
    createdAt: new Date(Date.UTC(2026, 9, 12, 0, 0, clock)).toISOString(),
    ...attachment,
  }

  fake.attachments.set(id, row)
  storage.objects.set(`pending/${ORGANIZATION_ID}/${row.userId}/${id}`, {
    bytes: new Uint8Array(row.size),
    contentType: row.contentType,
  })

  return row
}

// A file the conversation sent already, which its budget counts
function sentFile(attachment: Partial<FakeAttachment> = {}) {
  return upload({ messageId: createId(), ...attachment })
}

function send({
  text = 'What do these say?',
  attachmentIds = [] as string[],
  messageId = createId(),
}: { text?: string; attachmentIds?: string[]; messageId?: string } = {}) {
  return sendConversationMessage({
    organizationId: ORGANIZATION_ID,
    userId: AUTHOR,
    conversationId,
    messageId,
    text,
    drawnText: text,
    attachmentIds,
  })
}

function entryOf(position: number) {
  return [...fake.entries.values()].find(
    entry => entry.conversationId === conversationId && entry.position === position,
  )
}

/*
  A conversation whose first run stored its reply, the request that answered it settled with the
  usage given: the member's entry, the run's context and the reply, then the run ended
*/
async function answered(usage: { inputTokens: number; cacheReadInputTokens?: number; outputTokens: number }) {
  const result = await send({ text: 'Hi' })

  if (result.outcome !== 'sent') throw new Error(`The send answered ${result.outcome}`)

  const run = fake.runs.get(result.runId)
  const conversation = fake.conversations.get(conversationId)

  if (!run || !conversation) throw new Error('The send stored no run')

  const reserved = reserveConversationRequest(parseConversationRunUsage(null), {
    estimatedInputTokens: 0,
    configTokens: 1000,
    inputEndPosition: 0,
  })

  for (const [position, role, content] of [
    [1, 'SYSTEM', '[{"type":"text","text":"Context"}]'],
    [2, 'ASSISTANT', '[{"type":"text","text":"Hello"}]'],
  ] as const) {
    fake.entries.set(createId(), {
      id: createId(),
      conversationId,
      runId: run.id,
      position,
      role,
      content,
      drawnBlocks: 1,
    })
  }

  Object.assign(run, {
    status: 'COMPLETED',
    usage: settleConversationRequest(reserved.usage, reserved.index, createClaudeMessage({ content: [], usage }), {
      turnPosition: 2,
    }),
  })
  conversation.activeRunId = null
}

beforeEach(() => {
  fake.reset()
  storage.objects.clear()
  storage.calls.length = 0
  scripted.counts.length = 0
  conversationId = createId()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  fake.addMember(OTHER, ORGANIZATION_ID)
})

describe('sendConversationMessage with files', () => {
  test('sends files before the text, in the order they were uploaded, each by its id after a line naming it, and copies them', async () => {
    const image = upload({ name: 'Board.png' })
    const document = upload({ name: 'Plan.pdf', contentType: 'application/pdf', pageCount: 3 })
    const text = upload({ name: 'Notes.md', contentType: 'text/markdown' })
    const messageId = createId()
    const result = await send({ attachmentIds: [text.id, image.id, document.id], messageId })

    expect(result.outcome).toBe('sent')
    expect(entryOf(0)?.content).toBe(
      JSON.stringify([
        {
          type: 'text',
          text: `Board.png (attachment ${image.id})\nPlan.pdf (attachment ${document.id})\nNotes.md (attachment ${text.id})`,
        },
        { type: 'image', source: { type: 'file', file_id: image.claudeFileId } },
        { type: 'document', source: { type: 'file', file_id: document.claudeFileId }, title: 'Plan.pdf' },
        { type: 'document', source: { type: 'file', file_id: text.claudeFileId }, title: 'Notes.md' },
        { type: 'text', text: 'What do these say?' },
      ]),
    )

    for (const attachment of [image, document, text]) {
      expect(fake.attachments.get(attachment.id)?.messageId).toBe(messageId)
      expect(
        storage.objects.has(
          `organizations/${ORGANIZATION_ID}/users/${AUTHOR}/conversations/${conversationId}/${attachment.id}`,
        ),
      ).toBe(true)
    }

    expect(fake.conversations.get(conversationId)?.preview).toEqual({
      kind: 'MEMBER_TEXT',
      text: 'What do these say?',
      attachmentCount: 3,
      attachmentName: 'Board.png',
    })
  })

  test("sends files alone with no text block of the member's, the conversation titled after the first", async () => {
    const image = upload({ name: 'Board.png' })
    const result = await send({ text: '', attachmentIds: [image.id] })

    expect(result.outcome).toBe('sent')
    expect(JSON.parse(entryOf(0)?.content ?? '[]')).toEqual([
      { type: 'text', text: `Board.png (attachment ${image.id})` },
      { type: 'image', source: { type: 'file', file_id: image.claudeFileId } },
    ])
    expect(fake.conversations.get(conversationId)?.title).toBe('Board.png')
  })

  test('answers a message sent again with its run, its files sent already', async () => {
    const image = upload()
    const messageId = createId()
    const first = await send({ attachmentIds: [image.id], messageId })
    const again = await send({ attachmentIds: [image.id], messageId })

    expect(first.outcome).toBe('sent')
    expect(again).toEqual(first)
    expect([...fake.messages.values()]).toHaveLength(1)
  })

  test('copies a file once when the store that followed its copy was refused and sent again', async () => {
    const image = upload()
    let refusals = 1

    fake.beforeOperation = async name => {
      if (name === 'StartConversation' && refusals-- > 0) throw new Error('The conversation exists already')
    }

    expect((await send({ attachmentIds: [image.id] })).outcome).toBe('sent')
    expect(storage.calls.filter(call => call.startsWith('copy'))).toHaveLength(2)
    expect([...storage.objects.keys()].filter(name => name.startsWith('organizations/'))).toHaveLength(1)
  })

  test('refuses files that are not the caller’s ready to send in this conversation', async () => {
    for (const attachment of [
      upload({ userId: OTHER }),
      upload({ status: 'UPLOADING', claudeFileId: null, tokenCount: null }),
      sentFile(),
      upload({ conversationId: createId() }),
    ]) {
      expect((await send({ attachmentIds: [attachment.id] })).outcome).toBe('attachmentsInvalid')
    }

    expect((await send({ attachmentIds: [createId()] })).outcome).toBe('attachmentsInvalid')
    expect(fake.messages.size).toBe(0)
  })

  test('holds a conversation to its 15 MiB, 300 PDF pages, 20 images and 100 files', async () => {
    sentFile({ size: 14 * 1024 * 1024, contentType: 'application/pdf', pageCount: 250 })

    expect(await send({ attachmentIds: [upload({ size: 2 * 1024 * 1024 }).id] })).toMatchObject({
      outcome: 'overBudget',
    })
    expect(await send({ attachmentIds: [upload({ contentType: 'application/pdf', pageCount: 51 }).id] })).toMatchObject(
      { outcome: 'overBudget' },
    )
    expect(
      (await send({ attachmentIds: [upload({ contentType: 'application/pdf', pageCount: 50 }).id] })).outcome,
    ).toBe('sent')

    fake.reset()
    fake.addMember(AUTHOR, ORGANIZATION_ID)
    conversationId = createId()

    for (let index = 0; index < 20; index++) sentFile()

    expect(await send({ attachmentIds: [upload().id] })).toMatchObject({ outcome: 'overBudget' })
    expect((await send({ attachmentIds: [upload({ contentType: 'text/plain' }).id] })).outcome).toBe('sent')

    fake.reset()
    fake.addMember(AUTHOR, ORGANIZATION_ID)
    conversationId = createId()

    for (let index = 0; index < 100; index++) sentFile({ contentType: 'text/plain', size: 10 })

    expect(await send({ attachmentIds: [upload({ contentType: 'text/plain' }).id] })).toMatchObject({
      outcome: 'overBudget',
    })
  })

  test('counts none of another member’s files uploaded under the same id against the budget', async () => {
    for (let index = 0; index < 20; index++) sentFile({ userId: OTHER })

    expect((await send({ attachmentIds: [upload().id] })).outcome).toBe('sent')
  })

  test('refuses a first message whose files would bring its request past 700000 tokens', async () => {
    const result = await send({ attachmentIds: [upload({ tokenCount: 700_000 }).id] })

    expect(result).toMatchObject({ outcome: 'overBudget' })
    expect(fake.messages.size).toBe(0)
    expect(scripted.counts.at(-1)?.system).toBeDefined()
  })

  test('counts a long reply’s output, so its files refuse what its last input alone would have taken', async () => {
    await answered({ inputTokens: 400_000, outputTokens: 250_000 })

    const result = await send({ attachmentIds: [upload({ tokenCount: 60_000 }).id] })

    expect(result).toMatchObject({ outcome: 'overBudget' })
  })

  test('counts what the last request read from the cache', async () => {
    await answered({ inputTokens: 5000, cacheReadInputTokens: 645_000, outputTokens: 1000 })

    expect(await send({ attachmentIds: [upload({ tokenCount: 60_000 }).id] })).toMatchObject({ outcome: 'overBudget' })
  })

  test('counts the new text by the endpoint, Chinese and emoji alike, the line naming the files, and the files by their counts', async () => {
    await answered({ inputTokens: 5000, outputTokens: 1000 })

    const image = upload({ name: 'Board.png', tokenCount: 371 })

    expect((await send({ text: '定价策略 🚀👩🏽‍💻', attachmentIds: [image.id] })).outcome).toBe('sent')

    const counted = scripted.counts.at(-1)

    expect(counted?.system).toBeUndefined()
    expect(JSON.stringify(counted?.messages)).toContain('定价策略 🚀👩🏽‍💻')
    expect(JSON.stringify(counted?.messages)).toContain(`Board.png (attachment ${image.id})`)
    expect(JSON.stringify(counted?.messages)).not.toContain('file_')
  })

  test('counts whole a conversation whose runs stored no reply', async () => {
    const result = await send({ text: 'Hi' })

    if (result.outcome !== 'sent') throw new Error(`The send answered ${result.outcome}`)

    const run = fake.runs.get(result.runId)
    const conversation = fake.conversations.get(conversationId)

    if (run && conversation) {
      Object.assign(run, { status: 'FAILED' })
      conversation.activeRunId = null
    }

    expect((await send({ attachmentIds: [upload().id] })).outcome).toBe('sent')
    expect(scripted.counts.at(-1)?.system).toBeDefined()
  })

  test('refuses a file the bucket deleted while it waited, storing nothing', async () => {
    const image = upload()

    storage.objects.clear()

    expect((await send({ attachmentIds: [image.id] })).outcome).toBe('attachmentExpired')
    expect(fake.messages.size).toBe(0)
    expect(fake.attachments.get(image.id)?.messageId).toBeNull()
  })
})
