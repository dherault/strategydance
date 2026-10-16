import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { MessageCountTokensParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { MAX_CONVERSATION_SEND_INPUT_TOKENS, MAX_SUBAGENTS_PER_ACTION } from 'strategydance-core'

import type { ConversationRunQueue, ConversationRunReference } from '~types'

import createScriptedClaudeClient from '~domain/agent/testing/createScriptedClaudeClient'
import createConversationDatabaseFake, {
  type FakeAttachment,
} from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, {
  BRIEF,
  ORGANIZATION_ID,
  createId,
} from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

/*
  A count endpoint whose system prompt and tools take 1000 tokens, and each character of text one,
  so a test reads what was counted off the number
*/
function count(body: MessageCountTokensParams) {
  const characters = body.messages.reduce((total, message) => {
    if (typeof message.content === 'string') return total + message.content.length

    return total + message.content.reduce((sum, block) => sum + (block.type === 'text' ? block.text.length : 0), 0)
  }, 0)

  return (body.system ? 1000 : 0) + characters
}

const scripted = createScriptedClaudeClient({ count })

// The runs the launches started, which here nothing runs: each is on its way, unless a test says not
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/agent/conversationClaudeClient', () => ({ default: scripted.client }))

// The modules list no tool here, so the tools a launch counts are the subagent's own
mock.module('~domain/agent/connectConversationModules', () => ({
  default: async () => ({ tools: [], runners: [], close: async () => {} }),
}))

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: launchSubagent } = await import('./launchSubagent')
const { default: SUBAGENT_SYSTEM_PROMPT } = await import('~domain/agent/subagentSystemPrompt')

const AUTHOR = 'author'

function launch(parentId: string, overrides: Partial<Parameters<typeof launchSubagent>[0]> = {}) {
  return launchSubagent({
    organizationId: ORGANIZATION_ID,
    userId: AUTHOR,
    parentId,
    key: createId(),
    title: 'Research the competitors',
    brief: BRIEF,
    attachmentIds: [],
    ...overrides,
  })
}

async function launched(parentId: string, overrides: Partial<Parameters<typeof launchSubagent>[0]> = {}) {
  const result = await launch(parentId, overrides)

  if (result.outcome !== 'launched') throw new Error(`The launch answered ${result.outcome}`)

  return result
}

// A file of a conversation's, sent by its first message unless a test says it waits in a draft
function insertAttachment(conversationId: string, values: Partial<FakeAttachment> = {}) {
  const id = createId()
  const [sentBy] = [...fake.messages.values()].filter(message => message.conversationId === conversationId)
  const row: FakeAttachment = {
    id,
    userId: AUTHOR,
    organizationId: ORGANIZATION_ID,
    conversationId,
    messageId: sentBy?.id ?? null,
    status: 'READY',
    name: 'pricing.pdf',
    contentType: 'application/pdf',
    size: 2000,
    pageCount: 1,
    tokenCount: 1594,
    claudeFileId: `file_${id}`,
    createdAt: new Date().toISOString(),
    ...values,
  }

  fake.attachments.set(id, row)

  return row
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
  enqueueRun.mockImplementation(async () => true)
  scripted.counts.length = 0
})

describe('launchSubagent', () => {
  test('launches a subagent of the member’s conversation, its brief its first entry, its run queued on it', async () => {
    const parent = await kit.start()
    const { subagentId, runId } = await launched(parent.conversationId)

    expect(fake.conversations.get(subagentId)).toMatchObject({
      userId: AUTHOR,
      organizationId: ORGANIZATION_ID,
      parentId: parent.conversationId,
      title: 'Research the competitors',
      activeRunId: runId,
      launchRunId: null,
      launchToolUseId: null,
      launchAnchorPosition: 0,
      report: null,
    })
    expect(fake.conversations.get(parent.conversationId)?.subagentCount).toBe(1)
    expect(fake.runs.get(runId)).toMatchObject({ trigger: 'LAUNCH', status: 'QUEUED', number: 0, anchorPosition: 0 })
    expect(kit.readMessages({ ...parent, conversationId: subagentId, runId })).toMatchObject([
      { kind: 'BRIEF', text: BRIEF, runId, position: 0, attachmentIds: [] },
    ])
    expect(kit.readEntries({ ...parent, conversationId: subagentId, runId })).toMatchObject([
      { role: 'USER', position: 0, content: JSON.stringify([{ type: 'text', text: BRIEF }]) },
    ])
    expect(enqueueRun).toHaveBeenCalledWith(
      { organizationId: ORGANIZATION_ID, userId: AUTHOR, conversationId: subagentId, runId },
      'subagent-runs',
    )
  })

  test('answers a launch sent again with the subagent it made, and queues its run again while it waits', async () => {
    const parent = await kit.start()
    const key = createId()
    const first = await launched(parent.conversationId, { key })
    const again = await launched(parent.conversationId, { key })

    expect(again).toEqual(first)
    expect([...fake.conversations.values()].filter(({ parentId }) => parentId === parent.conversationId)).toHaveLength(
      1,
    )
    expect(fake.conversations.get(parent.conversationId)?.subagentCount).toBe(1)
    expect(enqueueRun).toHaveBeenCalledTimes(2)
  })

  test('hands over the files its parent sent, by their ids in the Files API, before the brief', async () => {
    const parent = await kit.start()
    const image = insertAttachment(parent.conversationId, { name: 'chart.png', contentType: 'image/png' })
    const pdf = insertAttachment(parent.conversationId)
    const { subagentId, runId } = await launched(parent.conversationId, { attachmentIds: [pdf.id, image.id] })
    const reference = { ...parent, conversationId: subagentId, runId }

    expect(JSON.parse(kit.readEntries(reference)[0]?.content ?? '[]')).toEqual([
      { type: 'document', source: { type: 'file', file_id: pdf.claudeFileId }, title: 'pricing.pdf' },
      { type: 'image', source: { type: 'file', file_id: image.claudeFileId } },
      { type: 'text', text: BRIEF },
    ])
    expect(kit.readMessages(reference)[0]?.attachmentIds).toEqual([pdf.id, image.id])
    // Measured whole, with the subagent's own prompt
    expect(scripted.counts.some(body => body.system === SUBAGENT_SYSTEM_PROMPT)).toBe(true)
  })

  test('refuses a file waiting in a draft, or another conversation’s, storing nothing', async () => {
    const parent = await kit.start()
    const other = await kit.start('Plan the hiring')
    const waiting = insertAttachment(parent.conversationId, { messageId: null })
    const elsewhere = insertAttachment(other.conversationId)

    for (const attachmentId of [waiting.id, elsewhere.id, createId()]) {
      expect(await launch(parent.conversationId, { attachmentIds: [attachmentId] })).toEqual({
        outcome: 'attachmentsInvalid',
      })
    }

    expect([...fake.conversations.values()].some(({ parentId }) => parentId)).toBe(false)
    expect(enqueueRun).not.toHaveBeenCalled()
  })

  test('refuses files that fit a send’s budget alone once the prompt, the tools, the context and the brief take it past', async () => {
    const parent = await kit.start()
    const near = insertAttachment(parent.conversationId, { tokenCount: MAX_CONVERSATION_SEND_INPUT_TOKENS - 500 })

    expect(await launch(parent.conversationId, { attachmentIds: [near.id] })).toMatchObject({ outcome: 'overBudget' })
    expect([...fake.conversations.values()].some(({ parentId }) => parentId)).toBe(false)

    const room = insertAttachment(parent.conversationId, { tokenCount: MAX_CONVERSATION_SEND_INPUT_TOKENS - 3000 })

    expect((await launch(parent.conversationId, { attachmentIds: [room.id] })).outcome).toBe('launched')
  })

  test('launches ten on the parent’s latest anchor, leaving out those deleted, and refuses the eleventh', async () => {
    const parent = await kit.start()
    const subagentIds = []

    for (let index = 0; index < MAX_SUBAGENTS_PER_ACTION; index++) {
      subagentIds.push((await launched(parent.conversationId)).subagentId)
    }

    expect(await launch(parent.conversationId)).toEqual({ outcome: 'tooManyOnAnchor' })

    // As a retry deletes the subagents of the runs it cuts
    const deleted = fake.conversations.get(subagentIds[0] ?? '')

    if (deleted) deleted.deletedAt = new Date().toISOString()

    expect((await launch(parent.conversationId)).outcome).toBe('launched')
    expect(await launch(parent.conversationId)).toEqual({ outcome: 'tooManyOnAnchor' })
  })

  test('refuses a parent holding its hundred subagents', async () => {
    const parent = await kit.start()
    const conversation = fake.conversations.get(parent.conversationId)

    if (conversation) conversation.subagentCount = 100

    expect(await launch(parent.conversationId)).toEqual({ outcome: 'tooMany' })
  })

  test('refuses a parent that is somebody else’s, deleted or a subagent, and anybody outside the organization', async () => {
    const parent = await kit.start()
    const { subagentId } = await launched(parent.conversationId)

    expect(await launch(subagentId)).toEqual({ outcome: 'missing' })
    expect(await launch(createId())).toEqual({ outcome: 'missing' })

    fake.addMember('other', ORGANIZATION_ID)

    expect(await launch(parent.conversationId, { userId: 'other' })).toEqual({ outcome: 'missing' })
    expect(await launch(parent.conversationId, { userId: 'stranger' })).toEqual({ outcome: 'forbidden' })

    const conversation = fake.conversations.get(parent.conversationId)

    if (conversation) conversation.deletedAt = new Date().toISOString()

    expect(await launch(parent.conversationId)).toEqual({ outcome: 'missing' })
  })

  test('refuses a title that is no line of 120 characters, a brief empty or past 20000, and a file named twice', async () => {
    const parent = await kit.start()
    const file = insertAttachment(parent.conversationId)

    for (const overrides of [
      { title: 'Two\nlines' },
      { title: 'a'.repeat(121) },
      { title: ' ' },
      { brief: '  ' },
      { brief: 'a'.repeat(20001) },
      { attachmentIds: [file.id, file.id] },
    ]) {
      expect(await launch(parent.conversationId, overrides)).toMatchObject({ outcome: 'invalid' })
    }

    expect([...fake.conversations.values()].some(({ parentId }) => parentId)).toBe(false)
  })

  test('answers unavailable when its run cannot be queued, keeping the subagent and its run queued', async () => {
    const parent = await kit.start()

    enqueueRun.mockImplementation(async () => false)

    const result = await launch(parent.conversationId)

    expect(result.outcome).toBe('unavailable')

    if (result.outcome !== 'unavailable') return

    expect(fake.runs.get(result.runId)?.status).toBe('QUEUED')
  })
})
