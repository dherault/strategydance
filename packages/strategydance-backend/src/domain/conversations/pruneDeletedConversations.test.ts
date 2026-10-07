import { beforeEach, describe, expect, mock, test } from 'bun:test'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

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

// A conversation deleted two days ago, written straight into its table, since a start prunes its
// author's on the way through
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

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  fake.addMember(OTHER, ORGANIZATION_ID)
})

describe('pruneDeletedConversations', () => {
  test('removes what was deleted over a day ago, whoever’s it is, with its runs, messages and transcript', async () => {
    const old = await start(AUTHOR, 48)
    const othersOld = await start(OTHER, 25)

    expect(await pruneDeletedConversations()).toEqual({ claimed: 2, deleted: 2 })
    expect(isLeft(old)).toBe(false)
    expect(isLeft(othersOld)).toBe(false)
  })

  test('keeps what can still be taken back, and what is not deleted', async () => {
    const recent = await start(AUTHOR, 23)
    const kept = await start(AUTHOR, null)

    expect(await pruneDeletedConversations()).toEqual({ claimed: 0, deleted: 0 })
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

  test('a restore is refused once the sweep has claimed the conversation, and kept when it came first', async () => {
    // Two authors, since a start prunes its own author's conversations deleted long enough ago
    const claimed = await start(OTHER, 48)
    const restored = await start(AUTHOR, 48)

    fake.restore(restored, AUTHOR, ORGANIZATION_ID)
    await sdk.claimDeletedConversations({})

    expect(fake.conversations.get(claimed)?.pruneClaimedAt).not.toBeNull()
    expect(() => fake.restore(claimed, OTHER, ORGANIZATION_ID)).toThrow('The conversation is gone for good')
    expect(fake.conversations.get(claimed)?.deletedAt).not.toBeNull()

    await pruneDeletedConversations()

    expect(isLeft(claimed)).toBe(false)
    expect(fake.conversations.get(restored)).toMatchObject({ deletedAt: null, pruneClaimedAt: null })
  })

  test('finishes, on the next sweep, a conversation an earlier one claimed and failed to delete', async () => {
    const old = await start(AUTHOR, 48)

    fake.beforeOperation = async name => {
      if (name === 'DeleteClaimedConversations') throw new Error('The database is unreachable')
    }

    await expect(pruneDeletedConversations()).rejects.toThrow('The database is unreachable')
    expect(fake.conversations.get(old)?.pruneClaimedAt).not.toBeNull()

    fake.beforeOperation = async () => {}

    expect(await pruneDeletedConversations()).toEqual({ claimed: 0, deleted: 1 })
    expect(isLeft(old)).toBe(false)
  })

  test('deletes twenty at a time', async () => {
    for (let count = 0; count < 45; count++) insertDeleted()

    expect(await pruneDeletedConversations()).toEqual({ claimed: 45, deleted: 45 })
    expect(fake.calls.filter(name => name === 'DeleteClaimedConversations')).toHaveLength(3)
    expect(fake.conversations.size).toBe(0)
  })

  test('deletes nothing, and asks for no delete, when nothing was deleted long enough ago', async () => {
    await start(AUTHOR, null)

    expect(await pruneDeletedConversations()).toEqual({ claimed: 0, deleted: 0 })
    expect(fake.calls).not.toContain('DeleteClaimedConversations')
  })
})
