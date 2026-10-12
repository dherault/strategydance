import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

import createClaudeFilesFake from '~domain/agent/testing/createClaudeFilesFake'
import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'

import createConversationDatabaseFake, { type FakeAttachment } from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()
const storage = createAttachmentStorageFake()
const files = createClaudeFilesFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~domain/conversations/conversationAttachmentStorage', () => ({ default: storage.storage }))

mock.module('~domain/agent/conversationClaudeFiles', () => ({ default: files.claudeFiles }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: pruneDeletedConversations } = await import('./pruneDeletedConversations')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const AUTHOR = 'author'

const OTHER = 'other'

const sdk = fake.sdk as Record<string, (dataConnect: unknown, variables?: Record<string, unknown>) => Promise<unknown>>

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

/*
  A conversation as a send starts one, with its message, run and transcript entry, then deleted the
  given hours ago, or never
*/
async function start(userId: string, deletedHoursAgo: number | null) {
  const conversationId = createId()

  await sdk.startConversation(
    {},
    {
      organizationId: ORGANIZATION_ID,
      userId,
      conversationId,
      runId: createId(),
      membershipCreatedAt: fake.memberships.get(`${userId}:${ORGANIZATION_ID}`)?.createdAt,
      title: 'Pricing',
      messageId: createId(),
      text: 'Pricing',
      preview: { kind: 'MEMBER_TEXT', text: 'Pricing' },
      content: '[]',
    },
  )

  const conversation = fake.conversations.get(conversationId)

  if (conversation && deletedHoursAgo !== null) {
    conversation.deletedAt = new Date(Date.now() - deletedHoursAgo * 60 * 60 * 1000).toISOString()
  }

  return conversationId
}

// A conversation deleted two days ago, written straight into its table
function insertDeleted() {
  const conversationId = createId()

  fake.conversations.set(conversationId, {
    id: conversationId,
    userId: AUTHOR,
    organizationId: ORGANIZATION_ID,
    title: 'Deleted',
    activeRunId: null,
    preview: null,
    previewMessageId: null,
    unreadCount: 0,
    nextRunNumber: 0,
    nextMessagePosition: 0,
    messageCount: 0,
    isFull: false,
    deletedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    pruneClaimedAt: null,
    updatedAt: new Date().toISOString(),
  })
}

// Whether anything of a conversation is left, the rows that cascade from it included
function isLeft(conversationId: string) {
  return (
    fake.conversations.has(conversationId)
    || [...fake.runs.values(), ...fake.messages.values(), ...fake.entries.values()].some(
      row => row.conversationId === conversationId,
    )
  )
}

afterEach(() => setSystemTime())

// A file uploaded under a conversation's id, sent or not, with its objects and its file in the Files API
function attach(conversationId: string, attachment: Partial<FakeAttachment> = {}) {
  const id = createId()
  const row: FakeAttachment = {
    id,
    userId: AUTHOR,
    organizationId: ORGANIZATION_ID,
    conversationId,
    messageId: null,
    status: 'READY',
    name: 'Board.png',
    contentType: 'image/png',
    size: 10,
    pageCount: null,
    tokenCount: 371,
    claudeFileId: `file_${id}`,
    createdAt: new Date().toISOString(),
    ...attachment,
  }
  const object = { bytes: new Uint8Array(10), contentType: 'image/png' }

  fake.attachments.set(id, row)
  storage.objects.set(`pending/${ORGANIZATION_ID}/${row.userId}/${id}`, object)
  files.files.set(`file_${id}`, {
    id: `file_${id}`,
    name: id,
    contentType: 'image/png',
    bytes: object.bytes,
    createdAt: '',
  })

  if (row.messageId) {
    storage.objects.set(
      `organizations/${ORGANIZATION_ID}/users/${row.userId}/conversations/${conversationId}/${id}`,
      object,
    )
  }

  return row
}

beforeEach(() => {
  fake.reset()
  storage.objects.clear()
  files.files.clear()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  fake.addMember(OTHER, ORGANIZATION_ID)
})

describe('pruneDeletedConversations', () => {
  test('deletes a pruned conversation’s files, sent and unsent, and keeps another member’s uploaded under its id', async () => {
    const conversationId = await start(AUTHOR, 48)
    const sent = attach(conversationId, { messageId: createId() })
    const unsent = attach(conversationId)
    const others = attach(conversationId, { userId: OTHER })

    expect(await pruneDeletedConversations()).toEqual({ claimed: 1, deleted: 1, deletedFiles: 2, deletedResults: 0 })
    expect(fake.attachments.has(sent.id)).toBe(false)
    expect(fake.attachments.has(unsent.id)).toBe(false)
    expect(files.files.has(`file_${sent.id}`)).toBe(false)
    expect(files.files.has(`file_${unsent.id}`)).toBe(false)
    expect([...storage.objects.keys()]).toEqual([`pending/${ORGANIZATION_ID}/${OTHER}/${others.id}`])
    expect(fake.attachments.get(others.id)?.status).toBe('READY')
  })

  test('keeps a conversation whose files could not be deleted, claimed, and finishes it the next sweep', async () => {
    const kept = await start(AUTHOR, 48)
    const pruned = await start(AUTHOR, 48)

    attach(kept, { messageId: createId() })
    storage.failures.deleteFolder = [new Error('Storage is down')]

    expect(await pruneDeletedConversations()).toMatchObject({ claimed: 2, deleted: 1 })
    expect(isLeft(kept)).toBe(true)
    expect(isLeft(pruned)).toBe(false)
    expect(fake.conversations.get(kept)?.pruneClaimedAt).not.toBeNull()

    expect(await pruneDeletedConversations()).toMatchObject({ claimed: 0, deleted: 1, deletedFiles: 1 })
    expect(isLeft(kept)).toBe(false)
  })

  test('removes what was deleted over a day ago, whoever’s it is, with its runs, messages and transcript', async () => {
    const old = await start(AUTHOR, 48)
    const othersOld = await start(OTHER, 25)

    expect(await pruneDeletedConversations()).toEqual({ claimed: 2, deleted: 2, deletedFiles: 0, deletedResults: 0 })
    expect(isLeft(old)).toBe(false)
    expect(isLeft(othersOld)).toBe(false)
  })

  test('removes what the agent’s module calls stored under a pruned conversation’s scope, and no other', async () => {
    const old = await start(AUTHOR, 48)
    const kept = await start(AUTHOR, null)
    const keep = (conversationId: string, key: string) =>
      fake.modules.results.set(`conversation:${conversationId}\n${key}`, {
        idempotencyScope: `conversation:${conversationId}`,
        idempotencyKey: key,
        userId: AUTHOR,
        organizationId: ORGANIZATION_ID,
        tool: 'create_document',
        argumentsHash: 'hash',
        result: '{}',
        expiresAt: null,
        createdAt: new Date().toISOString(),
      })

    keep(old, 'toolu_1')
    keep(old, 'toolu_2')
    keep(kept, 'toolu_3')

    expect(await pruneDeletedConversations()).toEqual({ claimed: 1, deleted: 1, deletedFiles: 0, deletedResults: 2 })
    expect([...fake.modules.results.keys()]).toEqual([`conversation:${kept}\ntoolu_3`])
    expect(fake.calls.indexOf('DeleteConversationModuleCallResults')).toBeLessThan(
      fake.calls.indexOf('DeleteClaimedConversations'),
    )
  })

  test('keeps what can still be taken back, and what is not deleted', async () => {
    const recent = await start(AUTHOR, 23)
    const kept = await start(AUTHOR, null)

    expect(await pruneDeletedConversations()).toEqual({ claimed: 0, deleted: 0, deletedFiles: 0, deletedResults: 0 })
    expect(fake.conversations.get(recent)?.pruneClaimedAt).toBeNull()
    expect(isLeft(recent)).toBe(true)
    expect(isLeft(kept)).toBe(true)
  })

  test('claims every conversation before it deletes any', async () => {
    await start(AUTHOR, 48)
    await pruneDeletedConversations()

    expect(fake.calls).toEqual(
      expect.arrayContaining(['ClaimDeletedConversations', 'GetClaimedConversations', 'DeleteClaimedConversations']),
    )
    expect(fake.calls.indexOf('ClaimDeletedConversations')).toBeLessThan(
      fake.calls.indexOf('DeleteClaimedConversations'),
    )
  })

  test('a restore is refused past a day, before and after the sweep claims it, and kept within it', async () => {
    const old = await start(AUTHOR, 48)
    const restored = await start(AUTHOR, 23)

    expect(() => fake.restore(old, AUTHOR, ORGANIZATION_ID)).toThrow('The conversation is gone for good')

    fake.restore(restored, AUTHOR, ORGANIZATION_ID)
    await sdk.claimDeletedConversations({})

    expect(fake.conversations.get(old)?.pruneClaimedAt).not.toBeNull()
    expect(() => fake.restore(old, AUTHOR, ORGANIZATION_ID)).toThrow('The conversation is gone for good')

    await pruneDeletedConversations()

    expect(isLeft(old)).toBe(false)
    expect(fake.conversations.get(restored)).toMatchObject({ deletedAt: null, pruneClaimedAt: null })
  })

  test('a start leaves its author’s conversations deleted over a day ago to the sweep', async () => {
    const old = await start(AUTHOR, 48)

    await start(AUTHOR, null)

    expect(isLeft(old)).toBe(true)
  })

  test('finishes, on the next sweep, a conversation an earlier one claimed and failed to delete', async () => {
    const old = await start(AUTHOR, 48)

    fake.beforeOperation = async name => {
      if (name === 'DeleteClaimedConversations') throw new Error('The database is unreachable')
    }

    await expect(pruneDeletedConversations()).rejects.toThrow('The database is unreachable')
    expect(fake.conversations.get(old)?.pruneClaimedAt).not.toBeNull()

    fake.beforeOperation = async () => {}

    expect(await pruneDeletedConversations()).toEqual({ claimed: 0, deleted: 1, deletedFiles: 0, deletedResults: 0 })
    expect(isLeft(old)).toBe(false)
  })

  test('deletes twenty at a time', async () => {
    for (let count = 0; count < 45; count++) insertDeleted()

    expect(await pruneDeletedConversations()).toEqual({ claimed: 45, deleted: 45, deletedFiles: 0, deletedResults: 0 })
    expect(fake.calls.filter(name => name === 'DeleteClaimedConversations')).toHaveLength(3)
    expect(fake.conversations.size).toBe(0)
  })

  test('stops deleting once its time is up, leaving the rest claimed for the next sweep', async () => {
    for (let count = 0; count < 45; count++) insertDeleted()

    // Each batch takes three minutes, so the second ends past the sweep's five
    fake.beforeOperation = async name => {
      if (name === 'DeleteClaimedConversations') setSystemTime(new Date(Date.now() + 3 * 60 * 1000))
    }

    expect(await pruneDeletedConversations()).toEqual({ claimed: 45, deleted: 40, deletedFiles: 0, deletedResults: 0 })
    expect(fake.conversations.size).toBe(5)

    fake.beforeOperation = async () => {}

    expect(await pruneDeletedConversations()).toEqual({ claimed: 0, deleted: 5, deletedFiles: 0, deletedResults: 0 })
  })

  test('deletes nothing, and asks for no delete, when nothing was deleted long enough ago', async () => {
    await start(AUTHOR, null)

    expect(await pruneDeletedConversations()).toEqual({ claimed: 0, deleted: 0, deletedFiles: 0, deletedResults: 0 })
    expect(fake.calls).not.toContain('DeleteClaimedConversations')
  })
})
