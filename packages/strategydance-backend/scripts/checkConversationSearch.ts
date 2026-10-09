import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import { MAX_CONVERSATION_SEARCHES } from 'strategydance-core'
import {
  connectorConfig,
  deleteExpiredConversationSearches,
  getConversationSearchCorpus,
  getConversationSearchQuota,
  recordConversationSearch,
  searchConversationMessages,
  searchConversationTitles,
  searchConversationsBySubstring,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

import buildSubstringSearchPatterns from '~domain/conversations/buildSubstringSearchPatterns'

/*
  Checks the conversation search's operations against the emulators, where CI cannot, since what
  they guard is in their SQL conditions and what they find is Postgres' full-text search:

    bun run check:conversation-search

  It makes two throwaway organizations, a few members and conversations, searches them through the
  backend connector's own operations, as the search route calls them, and removes everything it
  made, then exits non-zero naming each check that failed. The domain's tests run against a fake of
  these operations: this is what says the fake's conditions and matches are the SQL's.

  The sweep's delete takes no organization: it removes every search in the emulator made over a day
  ago, whoever made it, which no count reads any more.

  Like `checkConversationRuns.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:conversation-search`',
  )
  process.exit(1)
}

// The browser's connector, on an app of its own, as `checkConversationList.ts` explains
const webConnector = getDataConnect(
  { ...connectorConfig, connector: 'strategydance-web-connector' },
  initializeApp({ projectId: FIREBASE_PROJECT_ID }, 'web-connector'),
)

// Dashless, as the emulator writes a UUID back, so an id read compares with the one made
function createId() {
  return randomUUID().replaceAll('-', '')
}

const checkId = createId().slice(0, 8)
const organizationId = createId()
// An organization the searcher keeps a conversation in without being a member of it
const formerOrganizationId = createId()

// One account per group of checks, so the searches one makes never count against another's
const userIds = {
  searcher: `check-conversation-search-${checkId}-searcher`,
  other: `check-conversation-search-${checkId}-other`,
  racer: `check-conversation-search-${checkId}-racer`,
  patient: `check-conversation-search-${checkId}-patient`,
  outsider: `check-conversation-search-${checkId}-outsider`,
}

const failures: string[] = []

function check(name: string, hasPassed: boolean) {
  console.log(`${hasPassed ? 'ok    ' : 'FAILED'}  ${name}`)

  if (!hasPassed) failures.push(name)
}

type Variables = Record<string, unknown>

async function write(query: string, variables: Variables = {}) {
  await dataConnect.executeGraphql(query, { variables })
}

async function read<Data>(query: string, variables: Variables = {}) {
  const { data } = await dataConnect.executeGraphql<Data, Variables>(query, { variables })

  return data
}

// The cause of a refusal, which the Admin SDK puts on the first line of its message, or null when
// the operation went through
async function refusal(operation: Promise<unknown>) {
  try {
    await operation

    return null
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''
  }
}

function isSameSet(actual: string[], expected: string[]) {
  return actual.length === expected.length && expected.every(id => actual.includes(id))
}

async function setUp() {
  // Each signs up as the app has them do, since a user's row takes its id and address off the token
  for (const userId of Object.values(userIds)) {
    await webConnector.executeMutation(
      'CreateCurrentUser',
      { locale: 'EN', authenticationProviders: [] },
      { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } },
    )
  }

  await write(
    `mutation SetUp($organizationId: UUID!, $formerOrganizationId: UUID!) {
      first: organization_insert(data: { id: $organizationId, name: "Checked organization" })
      second: organization_insert(data: { id: $formerOrganizationId, name: "Checked former organization" })
    }`,
    { organizationId, formerOrganizationId },
  )

  for (const userId of Object.values(userIds)) {
    if (userId === userIds.outsider) continue

    await write(
      `mutation AddMember($organizationId: UUID!, $userId: String!) {
        userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: MEMBER })
      }`,
      { organizationId, userId },
    )
  }

  // The racer is in both, which says the allowance is per organization
  await write(
    `mutation AddRacer($organizationId: UUID!, $userId: String!) {
      userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: MEMBER })
    }`,
    { organizationId: formerOrganizationId, userId: userIds.racer },
  )
}

async function tearDown() {
  await write(
    `mutation TearDown($organizationId: UUID!, $formerOrganizationId: UUID!, $ids: [String!]!) {
      first: organization_delete(id: $organizationId)
      second: organization_delete(id: $formerOrganizationId)
      user_deleteMany(where: { id: { in: $ids } })
    }`,
    { organizationId, formerOrganizationId, ids: Object.values(userIds) },
  )
}

// Searches made a number of minutes ago, as many as asked, in batches of 100, the most one insert
// takes
async function insertSearches(userId: string, count: number, minutesAgo: number, inOrganizationId = organizationId) {
  for (let index = 0; index < count; index += 100) {
    const rows = Array.from({ length: Math.min(100, count - index) }, () => ({
      userId,
      organizationId: inOrganizationId,
      // A list's rows take no `_time` expression, and this machine's clock is the emulator's
      createdAt: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
    }))

    await write(
      `mutation InsertSearches($rows: [ConversationSearch_Data!]!) {
        conversationSearch_insertMany(data: $rows)
      }`,
      { rows },
    )
  }
}

async function checkQuota() {
  const record = (userId: string, inOrganizationId = organizationId) =>
    refusal(recordConversationSearch(dataConnect, { organizationId: inOrganizationId, userId }))

  await insertSearches(userIds.racer, MAX_CONVERSATION_SEARCHES - 1, 0)

  const outcomes = await Promise.all([record(userIds.racer), record(userIds.racer)])

  check(
    'two searches at once at 119 let exactly one through',
    outcomes.filter(outcome => outcome === null).length === 1,
  )
  check(
    'the one refused says why',
    outcomes.some(outcome => outcome?.includes('at most 120 times in ten minutes') ?? false),
  )

  const { data: quota } = await getConversationSearchQuota(dataConnect, { organizationId, userId: userIds.racer })

  check(
    'the quota reads the membership and the last ten minutes’ searches, newest first, to 120',
    quota.userOrganization !== null
      && quota.conversationSearches.length === MAX_CONVERSATION_SEARCHES
      && quota.conversationSearches.every(
        (search, index, searches) => index === 0 || searches[index - 1]!.createdAt >= search.createdAt,
      ),
  )
  check(
    'the allowance is per organization: the same member searches another one',
    (await record(userIds.racer, formerOrganizationId)) === null,
  )

  await insertSearches(userIds.patient, MAX_CONVERSATION_SEARCHES, 11)

  check('searches over ten minutes old do not count', (await record(userIds.patient)) === null)
  check(
    'somebody outside the organization cannot search it',
    (await record(userIds.outsider))?.includes('Only a member of an organization') ?? false,
  )
}

type Message = { kind: string; text: string | null }

// A conversation with its messages, inserted directly, since a search reads only what is stored
async function insertConversation({
  userId = userIds.searcher,
  inOrganizationId = organizationId,
  title,
  messages = [],
  isDeleted = false,
  minutesAgo = 0,
}: {
  userId?: string
  inOrganizationId?: string
  title: string
  messages?: Message[]
  isDeleted?: boolean
  minutesAgo?: number
}) {
  const id = createId()

  await write(
    `mutation InsertConversation($id: UUID!, $userId: String!, $organizationId: UUID!, $title: String!, $messageCount: Int!, $minutesAgo: Int!) {
      conversation_insert(data: {
        id: $id, userId: $userId, organizationId: $organizationId, title: $title, messageCount: $messageCount,
        nextMessagePosition: $messageCount, updatedAt_time: { now: true, sub: { minutes: $minutesAgo } }
      })
    }`,
    { id, userId, organizationId: inOrganizationId, title, messageCount: messages.length, minutesAgo },
  )

  if (messages.length) {
    await write(
      `mutation InsertMessages($rows: [ConversationMessage_Data!]!) {
        conversationMessage_insertMany(data: $rows)
      }`,
      {
        rows: messages.map((message, position) => ({ conversationId: id, position, ...message })),
      },
    )
  }

  if (isDeleted) {
    await write(
      `mutation DeleteConversation($id: UUID!) {
        conversation_update(id: $id, data: { deletedAt_expr: "request.time" })
      }`,
      { id },
    )
  }

  return id
}

async function checkFullText() {
  const pricing = await insertConversation({
    title: 'Pricing strategy for the launch',
    messages: [
      { kind: 'MEMBER_TEXT', text: 'How should we price the running shoes?' },
      { kind: 'AGENT_TEXT', text: 'Consider a premium tier, and **anchor** it against the basic one.' },
    ],
  })
  const hiring = await insertConversation({
    title: 'Hiring',
    messages: [
      { kind: 'AGENT_TEXT', text: 'We run weekly reviews with every candidate.' },
      // Words only a note or a question would hold, which the search leaves out
      { kind: 'NOTE', text: 'premium noted' },
    ],
  })
  const french = await insertConversation({
    title: 'Équipe',
    messages: [{ kind: 'MEMBER_TEXT', text: "Comment motiver l'équipe pendant l'été ?" }],
  })

  await insertConversation({ title: 'Pricing, deleted', isDeleted: true })
  await insertConversation({ title: 'Pricing, somebody else’s', userId: userIds.other })
  await insertConversation({ title: 'Pricing, from before', inOrganizationId: formerOrganizationId })

  const titles = async (query: string) => {
    const { data } = await searchConversationTitles(dataConnect, { organizationId, userId: userIds.searcher, query })

    return data.conversations_search.map(conversation => conversation.id)
  }
  const messages = async (query: string, offset = 0) => {
    const { data } = await searchConversationMessages(dataConnect, {
      organizationId,
      userId: userIds.searcher,
      query,
      offset,
    })

    return data.conversationMessages_search.map(message => message.conversationId)
  }

  check(
    'a title search finds the caller’s conversation, and none deleted, somebody else’s or another organization’s',
    isSameSet(await titles('pricing'), [pricing]),
  )
  check('a title search ignores case', isSameSet(await titles('PRICING Strategy'), [pricing]))
  check('a title search needs every word, in any order', isSameSet(await titles('launch pricing'), [pricing]))
  check('a title search finds nothing when one word is missing', (await titles('pricing hiring')).length === 0)
  check('a message search finds the member’s words', isSameSet(await messages('shoes price'), [pricing]))
  check('a message search finds the agent’s words, through Markdown', isSameSet(await messages('anchor'), [pricing]))
  check('a message search stems nothing: "run" misses "running"', isSameSet(await messages('run'), [hiring]))
  check('a message search leaves notes out', isSameSet(await messages('premium'), [pricing]))
  check('a message search pages by offset', (await messages('premium', 500)).length === 0)
  check('a French word is found inside an elision', isSameSet(await messages('équipe'), [french]))
  check('a French title is found in capitals', isSameSet(await titles('ÉQUIPE'), [french]))
  check('a word with an accent is found without the punctuation around it', isSameSet(await messages('été'), [french]))

  // Somebody removed from the organization finds nothing there, though their conversations stay
  await write(
    `mutation Leave($organizationId: UUID!, $userId: String!) {
      userOrganization_delete(key: { userId: $userId, organizationId: $organizationId })
    }`,
    { organizationId: formerOrganizationId, userId: userIds.searcher },
  )

  const { data: former } = await searchConversationTitles(dataConnect, {
    organizationId: formerOrganizationId,
    userId: userIds.searcher,
    query: 'pricing',
  })

  check('somebody no longer a member finds nothing', former.conversations_search.length === 0)
}

async function checkSubstrings() {
  const chinese = await insertConversation({
    title: '定价策略',
    messages: [{ kind: 'MEMBER_TEXT', text: '我们应该如何为新产品定价？' }],
    minutesAgo: 1,
  })
  const japanese = await insertConversation({
    title: '相談',
    messages: [{ kind: 'AGENT_TEXT', text: '価格設定についてご相談ください。' }],
    minutesAgo: 2,
  })
  const escaped = await insertConversation({ title: '100% sure_thing', minutesAgo: 3 })
  const unescaped = await insertConversation({ title: '1000 sureXthing', minutesAgo: 4 })
  const noted = await insertConversation({
    title: 'Notes',
    messages: [{ kind: 'NOTE', text: '如何定价' }],
    minutesAgo: 5,
  })

  const { data: corpus } = await getConversationSearchCorpus(dataConnect, { organizationId, userId: userIds.searcher })
  const corpusIds = corpus.conversations.map(conversation => conversation.id)

  check(
    'the corpus lists the caller’s conversations most recently active first, with their message counts',
    corpusIds.indexOf(chinese) < corpusIds.indexOf(japanese)
      && corpusIds.indexOf(japanese) < corpusIds.indexOf(escaped)
      && corpus.conversations.find(conversation => conversation.id === chinese)?.messageCount === 1,
  )

  const search = async (terms: string[], recentIds = corpusIds) => {
    const { data } = await searchConversationsBySubstring(dataConnect, {
      organizationId,
      userId: userIds.searcher,
      recentIds,
      ...buildSubstringSearchPatterns(terms),
    })

    return data.conversations.map(conversation => conversation.id)
  }

  check('a Chinese word is found inside a title', isSameSet(await search(['定价']), [chinese]))
  check('a Chinese phrase is found inside a member’s message', isSameSet(await search(['如何', '定价']), [chinese]))
  check('a Japanese word is found inside an agent’s message', isSameSet(await search(['価格設定']), [japanese]))
  check('every word has to be in the same text', (await search(['定价', '価格'])).length === 0)
  check(
    'a message outside the recent conversations is not read, while its title still is',
    (await search(['価格設定'], [chinese])).length === 0 && isSameSet(await search(['相談'], [chinese]), [japanese]),
  )
  check('a note’s text is not read', !(await search(['如何定价'])).includes(noted))
  // Unescaped, `%100%%` would match "1000" and `%e_t%` the X in "sureXthing"
  check('`%` matches only itself', isSameSet(await search(['100%']), [escaped]))
  check(
    '`_` matches only itself',
    isSameSet(await search(['e_t']), [escaped]) && !(await search(['e_t'])).includes(unescaped),
  )
  check('a substring ignores case', isSameSet(await search(['SURE_THING']), [escaped]))
}

async function checkSweeping() {
  await insertSearches(userIds.other, 2, 25 * 60)
  await insertSearches(userIds.other, 1, 23 * 60)

  const countOthers = async () => {
    const data = await read<{ conversationSearches: { id: string }[] }>(
      `query CountSearches($userId: String!) {
        conversationSearches(where: { userId: { eq: $userId } }) { id }
      }`,
      { userId: userIds.other },
    )

    return data.conversationSearches.length
  }

  check('the searches to sweep are there', (await countOthers()) === 3)

  await deleteExpiredConversationSearches(dataConnect)

  check('the sweep deletes the searches over a day old, and keeps the rest', (await countOthers()) === 1)
}

try {
  await setUp()
  await checkQuota()
  await checkFullText()
  await checkSubstrings()
  await checkSweeping()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')
