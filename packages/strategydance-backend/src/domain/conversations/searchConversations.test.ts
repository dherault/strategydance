import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

import { MAX_CONVERSATION_SEARCHES, MAX_CONVERSATIONS } from 'strategydance-core'

import createConversationDatabaseFake, { type FakeConversation } from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: searchConversations } = await import('./searchConversations')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const OTHER_ORGANIZATION_ID = '1a2b3c4d5e6f40718293a4b5c6d7e8f9'

const SEARCHER = 'searcher'

const OTHER = 'other'

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

let minutesAgo = 0

// A conversation written straight into its table, each one older than the one before, so the most
// recently active is the first inserted
function insertConversation(fields: Partial<FakeConversation> & { title: string }) {
  const conversation: FakeConversation = {
    id: createId(),
    userId: SEARCHER,
    organizationId: ORGANIZATION_ID,
    activeRunId: null,
    preview: null,
    previewMessageId: null,
    unreadCount: 0,
    nextRunNumber: 0,
    nextMessagePosition: 0,
    messageCount: 0,
    isFull: false,
    deletedAt: null,
    pruneClaimedAt: null,
    updatedAt: new Date(Date.now() - ++minutesAgo * 60 * 1000).toISOString(),
    ...fields,
  }

  fake.conversations.set(conversation.id, conversation)

  return conversation.id
}

function insertMessage(conversationId: string, kind: string, text: string) {
  const conversation = fake.conversations.get(conversationId)!
  const id = createId()

  fake.messages.set(id, {
    id,
    conversationId,
    runId: null,
    kind,
    text,
    noteKind: null,
    toolStatus: null,
    position: conversation.nextMessagePosition++,
  })
}

// Searches as the searcher in the organization, and answers what was found
async function search(query: string) {
  const result = await searchConversations({ organizationId: ORGANIZATION_ID, userId: SEARCHER, query })

  if (result.outcome !== 'found') throw new Error(`The search was refused: ${result.outcome}`)

  return result
}

function countCalls(name: string) {
  return fake.calls.filter(call => call === name).length
}

beforeEach(() => {
  fake.reset()
  fake.addMember(SEARCHER, ORGANIZATION_ID)
  fake.addMember(OTHER, ORGANIZATION_ID)
  minutesAgo = 0
})

afterEach(() => {
  setSystemTime()
})

describe('searching by the full-text indexes', () => {
  test('merges the titles and the messages that match, one conversation each', async () => {
    const titled = insertConversation({ title: 'Pricing plan' })
    const asked = insertConversation({ title: 'Launch' })
    const answered = insertConversation({ title: 'Hiring' })
    const noted = insertConversation({ title: 'Notes' })

    insertMessage(titled, 'MEMBER_TEXT', 'What about pricing, and pricing again?')
    insertMessage(asked, 'MEMBER_TEXT', 'Help me with pricing.')
    insertMessage(asked, 'AGENT_TEXT', 'Pricing first: what does it cost you?')
    insertMessage(answered, 'AGENT_TEXT', 'Your **pricing** comes after the hire.')
    insertMessage(noted, 'NOTE', 'pricing')
    insertMessage(noted, 'QUESTION', 'pricing')

    const result = await search('PRICING')

    expect(result.coverage).toBe('ALL')
    expect(result.conversationIds.sort()).toEqual([titled, asked, answered].sort())
  })

  test('finds every word in one title or one message, never spread over two', async () => {
    const together = insertConversation({ title: 'Launch' })
    const apart = insertConversation({ title: 'Pricing' })

    insertMessage(together, 'MEMBER_TEXT', 'The tiers of our pricing')
    insertMessage(apart, 'MEMBER_TEXT', 'Three tiers')

    expect((await search('pricing tiers')).conversationIds).toEqual([together])
  })

  test('leaves out deleted conversations, and anybody else’s', async () => {
    const kept = insertConversation({ title: 'Pricing' })

    insertConversation({ title: 'Pricing', deletedAt: new Date().toISOString() })
    insertConversation({ title: 'Pricing', userId: OTHER })
    insertConversation({ title: 'Pricing', organizationId: OTHER_ORGANIZATION_ID })

    expect((await search('pricing')).conversationIds).toEqual([kept])
  })

  test('answers every match once every conversation somebody can keep has matched', async () => {
    for (let index = 0; index < MAX_CONVERSATIONS; index++) {
      const conversationId = insertConversation({ title: `Conversation ${index}` })

      for (let message = 0; message < 6; message++) insertMessage(conversationId, 'MEMBER_TEXT', 'pricing')
    }

    const result = await search('pricing')

    // The 5000 messages read reach only some of them, and the titles the rest
    expect(result.conversationIds).toHaveLength(MAX_CONVERSATIONS)
    expect(result.coverage).toBe('ALL')
  })

  test('reads the messages once, to 5000, and answers the best matches past them', async () => {
    const crowded = [insertConversation({ title: 'A' }), insertConversation({ title: 'B' })]
    const late = insertConversation({ title: 'C' })

    for (const conversationId of crowded) {
      for (let index = 0; index < 3000; index++) insertMessage(conversationId, 'MEMBER_TEXT', 'pricing pricing')
    }

    // Less relevant, so it comes after the 5000 read
    insertMessage(late, 'MEMBER_TEXT', 'pricing')

    const result = await search('pricing')

    expect(result.coverage).toBe('BEST_MATCHES')
    expect(result.conversationIds.sort()).toEqual([...crowded].sort())
    expect(countCalls('SearchConversationMessages')).toBe(1)
  })

  test('answers every match while the messages fall short of 5000', async () => {
    const conversationId = insertConversation({ title: 'Launch' })

    for (let index = 0; index < 4999; index++) insertMessage(conversationId, 'MEMBER_TEXT', 'pricing')

    const result = await search('pricing')

    expect(result.coverage).toBe('ALL')
    expect(countCalls('SearchConversationMessages')).toBe(1)
  })
})

describe('searching by substring', () => {
  test('takes Chinese and Japanese queries, and only those, past the indexes', async () => {
    const chinese = insertConversation({ title: '定价策略' })
    const japanese = insertConversation({ title: '相談' })

    insertMessage(japanese, 'AGENT_TEXT', '価格設定についてご相談ください。')

    expect((await search('定价')).conversationIds).toEqual([chinese])
    expect((await search('価格設定')).conversationIds).toEqual([japanese])
    expect(countCalls('SearchConversationTitles')).toBe(0)
    expect(countCalls('SearchConversationsBySubstring')).toBe(2)

    await search('pricing')

    expect(countCalls('SearchConversationTitles')).toBe(1)
  })

  test('needs every word in one title or one message', async () => {
    const together = insertConversation({ title: '会議' })
    const apart = insertConversation({ title: '定价' })

    insertMessage(together, 'MEMBER_TEXT', '我们应该如何为新产品定价？')
    insertMessage(apart, 'MEMBER_TEXT', '如何')

    expect((await search('如何 定价')).conversationIds).toEqual([together])
  })

  test('reads the messages of the most recent conversations to 20000, newest first, and every title', async () => {
    const newest = insertConversation({ title: '会議', messageCount: 15000 })
    const crowded = insertConversation({ title: '会議', messageCount: 6000 })
    const older = insertConversation({ title: '定价会议', messageCount: 10 })
    const oldest = insertConversation({ title: '会議', messageCount: 10 })
    let recentIds: string[] = []

    insertMessage(newest, 'MEMBER_TEXT', '如何定价')
    insertMessage(crowded, 'MEMBER_TEXT', '定价')
    insertMessage(oldest, 'MEMBER_TEXT', '定价')

    fake.beforeOperation = async (name, variables) => {
      if (name === 'SearchConversationsBySubstring') recentIds = variables.recentIds
    }

    const result = await search('定价')

    // The crowded one would pass 20000, so it and every older one are left out, the small one too
    expect(recentIds).toEqual([newest])
    expect(result.conversationIds.sort()).toEqual([newest, older].sort())
    expect(result.coverage).toBe('RECENT')
  })

  test('says it searched everything when every conversation fit', async () => {
    const conversationId = insertConversation({ title: '会議', messageCount: 1 })

    insertMessage(conversationId, 'MEMBER_TEXT', '如何定价')

    expect(await search('定价')).toEqual({ outcome: 'found', conversationIds: [conversationId], coverage: 'ALL' })
  })

  test('matches `%` and `_` as themselves', async () => {
    const percent = insertConversation({ title: '定价100%' })
    const underscore = insertConversation({ title: '定_价' })

    insertConversation({ title: '定价1000' })
    insertConversation({ title: '定X价' })

    expect((await search('100%定价')).conversationIds).toEqual([])
    expect((await search('定价100%')).conversationIds).toEqual([percent])
    expect((await search('定_价')).conversationIds).toEqual([underscore])
  })
})

describe('the allowance', () => {
  test('refuses the 121st search in ten minutes, saying when the next one fits', async () => {
    const start = new Date('2026-10-09T10:00:00.000Z')

    for (let index = 0; index < MAX_CONVERSATION_SEARCHES; index++) {
      setSystemTime(new Date(start.getTime() + index * 1000))
      await search('pricing')
    }

    setSystemTime(new Date(start.getTime() + 5 * 60 * 1000))

    const titleCalls = countCalls('SearchConversationTitles')
    const refused = await searchConversations({ organizationId: ORGANIZATION_ID, userId: SEARCHER, query: 'pricing' })

    // The first of the 120 ages out ten minutes after it was made, five from now
    expect(refused.outcome).toBe('tooMany')
    expect(refused.outcome === 'tooMany' && Math.round(refused.retryAfterMs / 1000)).toBe(5 * 60)
    expect(countCalls('SearchConversationTitles')).toBe(titleCalls)

    setSystemTime(new Date(start.getTime() + 10 * 60 * 1000 + 1))

    expect((await search('pricing')).outcome).toBe('found')
  })

  test('is per member and organization', async () => {
    fake.addMember(SEARCHER, OTHER_ORGANIZATION_ID)

    for (let index = 0; index < MAX_CONVERSATION_SEARCHES; index++) await search('pricing')

    const elsewhere = await searchConversations({
      organizationId: OTHER_ORGANIZATION_ID,
      userId: SEARCHER,
      query: 'pricing',
    })
    const somebodyElse = await searchConversations({ organizationId: ORGANIZATION_ID, userId: OTHER, query: 'pricing' })

    expect(elsewhere.outcome).toBe('found')
    expect(somebodyElse.outcome).toBe('found')
  })

  test('refuses somebody who is no longer a member, rather than counting them out', async () => {
    fake.removeMember(SEARCHER, ORGANIZATION_ID)

    expect(await searchConversations({ organizationId: ORGANIZATION_ID, userId: SEARCHER, query: 'pricing' })).toEqual({
      outcome: 'forbidden',
    })
    expect(fake.searches.size).toBe(0)
  })
})
