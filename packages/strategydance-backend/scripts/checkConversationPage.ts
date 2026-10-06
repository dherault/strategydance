import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import { MAX_CONVERSATION_MESSAGES } from 'strategydance-core'
import { connectorConfig } from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the conversation page's operations against the emulators, where CI cannot, since what
  they guard is in their SQL conditions:

    bun run check:conversation-page

  It makes a throwaway organization with two members, a conversation of 220 messages and a few
  others, runs the web connector's own operations as those members, and removes everything it
  made, then exits non-zero naming each check that failed. As `checkConversationList.ts` does, the
  operations go through the Admin SDK impersonating a member, so their `@auth` level and every
  `@check` are evaluated as for that member's token.

  It refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:conversation-page`',
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

const runId = createId().slice(0, 8)
const authorId = `check-conversation-page-${runId}-author`
const memberId = `check-conversation-page-${runId}-member`
const outsiderId = `check-conversation-page-${runId}-outsider`
const organizationId = createId()

// The latest messages the page's live query reads, and the messages a history page reads, as the
// web connector's operations hold them
const TAIL_LENGTH = 150
const PAGE_LENGTH = 100

const failures: string[] = []

function check(name: string, hasPassed: boolean) {
  console.log(`${hasPassed ? 'ok    ' : 'FAILED'}  ${name}`)

  if (!hasPassed) failures.push(name)
}

type Variables = Record<string, unknown>

// Whether the operation went through when the given account ran it
async function runAs(userId: string, name: string, variables: Variables) {
  try {
    await webConnector.executeMutation(name, variables, { impersonate: { authClaims: { sub: userId } } })

    return true
  } catch {
    return false
  }
}

async function readAs<Data>(userId: string, name: string, variables: Variables) {
  const { data } = await webConnector.executeQuery<Data, Variables>(name, variables, {
    impersonate: { authClaims: { sub: userId } },
  })

  return data
}

async function write(query: string, variables: Variables = {}) {
  await dataConnect.executeGraphql(query, { variables })
}

type StoredConversation = {
  aspects: string[]
  aspectsSetBy: string | null
  unreadCount: number
  nextMessagePosition: number
  messageCount: number
  updatedAt: string
}

async function readConversation(id: string) {
  const { data } = await dataConnect.executeGraphql<{ conversation: StoredConversation | null }, Variables>(
    `query ReadConversation($id: UUID!) {
      conversation(id: $id) { aspects aspectsSetBy unreadCount nextMessagePosition messageCount updatedAt }
    }`,
    { variables: { id } },
  )

  return data.conversation
}

async function readMessageKindAt(conversationId: string, position: number) {
  const { data } = await dataConnect.executeGraphql<{ conversationMessages: { kind: string }[] }, Variables>(
    `query ReadMessageAt($conversationId: UUID!, $position: Int!) {
      conversationMessages(where: { conversationId: { eq: $conversationId }, position: { eq: $position } }) { kind }
    }`,
    { variables: { conversationId, position } },
  )

  return data.conversationMessages[0]?.kind ?? null
}

// In batches of 100, the most one insert takes
async function insertMany(table: string, rows: Variables[]) {
  for (let start = 0; start < rows.length; start += 100) {
    await write(
      `mutation InsertRows($rows: [${table}_Data!]!) {
        ${table.charAt(0).toLowerCase()}${table.slice(1)}_insertMany(data: $rows)
      }`,
      { rows: rows.slice(start, start + 100) },
    )
  }
}

const deletedAt = new Date().toISOString()

// The checked conversation holds 220 messages at positions 0 to 220, with 100 missing, as a retry
// leaves a hole
const MESSAGE_POSITIONS = Array.from({ length: 221 }, (_, position) => position).filter(position => position !== 100)
const toolCallPosition = 205
const latestPosition = 220

const conversations = {
  checked: createId(),
  deleted: createId(),
  full: createId(),
  members: createId(),
}

const messageIds = new Map(MESSAGE_POSITIONS.map(position => [position, createId()]))
const membersMessageId = createId()

function messageAt(position: number) {
  if (position === toolCallPosition) {
    return {
      kind: 'TOOL_CALL',
      toolName: 'search_knowledge',
      toolStatus: 'SUCCEEDED',
      toolInput: '{"query":"pricing"}',
      toolOutput: '{"results":[]}',
      toolDurationMs: 120,
    }
  }

  return position % 2 === 0
    ? { kind: 'MEMBER_TEXT', text: `Message ${position}` }
    : { kind: 'AGENT_TEXT', text: `Reply ${position}` }
}

async function setUp() {
  // Each signs up as the app has them do, since a user's row takes its id and address off the token
  for (const userId of [authorId, memberId, outsiderId]) {
    await webConnector.executeMutation(
      'CreateCurrentUser',
      { locale: 'EN', authenticationProviders: [] },
      { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } },
    )
  }

  await write(
    `mutation SetUp($organizationId: UUID!, $authorId: String!, $memberId: String!) {
      organization_insert(data: { id: $organizationId, name: "Checked organization" })
      author: userOrganization_insert(data: { userId: $authorId, organizationId: $organizationId, role: MEMBER })
      member: userOrganization_insert(data: { userId: $memberId, organizationId: $organizationId, role: MEMBER })
    }`,
    { organizationId, authorId, memberId },
  )

  const conversation = (id: string, userId: string, fields: Variables = {}) => ({
    id,
    userId,
    organizationId,
    title: 'Checked conversation',
    ...fields,
  })

  await insertMany('Conversation', [
    conversation(conversations.checked, authorId, {
      nextMessagePosition: latestPosition + 1,
      messageCount: MESSAGE_POSITIONS.length,
      historyRevision: 2,
      previewMessageId: messageIds.get(latestPosition),
      unreadCount: 3,
    }),
    conversation(conversations.deleted, authorId, { deletedAt }),
    conversation(conversations.full, authorId, {
      nextMessagePosition: MAX_CONVERSATION_MESSAGES,
      messageCount: MAX_CONVERSATION_MESSAGES,
    }),
    conversation(conversations.members, memberId, { nextMessagePosition: 1, messageCount: 1 }),
  ])
  await insertMany('ConversationMessage', [
    ...MESSAGE_POSITIONS.map(position => ({
      id: messageIds.get(position),
      conversationId: conversations.checked,
      position,
      ...messageAt(position),
    })),
    { id: membersMessageId, conversationId: conversations.members, position: 0, kind: 'MEMBER_TEXT', text: 'Mine' },
  ])

  const run = (number: number, status: string) => ({
    conversationId: conversations.checked,
    number,
    trigger: 'MESSAGE',
    status,
    membershipCreatedAt: deletedAt,
    anchorPosition: 0,
  })

  await insertMany('ConversationRun', [run(0, 'COMPLETED'), run(1, 'RUNNING'), run(2, 'QUEUED')])
}

async function tearDown() {
  await write(
    `mutation TearDown($organizationId: UUID!, $ids: [String!]!) {
      organization_delete(id: $organizationId)
      user_deleteMany(where: { id: { in: $ids } })
    }`,
    { organizationId, ids: [authorId, memberId, outsiderId] },
  )
}

type Message = { id: string; position: number; text?: string | null }
type ConversationRead = { conversations: { conversationMessages_on_conversation: Message[] }[] }
type PageRead = { conversations: { historyRevision: number }[]; conversationMessages: Message[] }

function isDescending(messages: Message[]) {
  return messages.every((message, index) => index === 0 || messages[index - 1]!.position > message.position)
}

async function runChecks() {
  const conversation = (id: string) => ({ organizationId, id })

  // The live tail
  const read = await readAs<ConversationRead>(authorId, 'GetConversation', conversation(conversations.checked))
  const tail = read.conversations[0]?.conversationMessages_on_conversation ?? []

  check(
    `the tail reads the latest ${TAIL_LENGTH} messages, newest first`,
    tail.length === TAIL_LENGTH && tail[0]?.position === latestPosition && isDescending(tail),
  )

  for (const [name, userId, id] of [
    ['a deleted conversation', authorId, conversations.deleted],
    ["another member's conversation", authorId, conversations.members],
    ['a conversation read from outside the organization', outsiderId, conversations.checked],
  ] as const) {
    const { conversations: found } = await readAs<ConversationRead>(userId, 'GetConversation', conversation(id))

    check(`${name} reads nothing`, found.length === 0)
  }

  // The history before it: a full page from inside the tail, over the hole, then what is left below
  // the tail
  const page = await readAs<PageRead>(authorId, 'GetConversationMessagesBefore', {
    ...conversation(conversations.checked),
    beforePosition: 200,
  })

  check(
    `a history page reads the ${PAGE_LENGTH} messages before a position, newest first, with their text and revision`,
    page.conversationMessages.length === PAGE_LENGTH
      && page.conversationMessages[0]!.position === 199
      && isDescending(page.conversationMessages)
      && page.conversationMessages.every(({ text }) => typeof text === 'string')
      && page.conversations[0]?.historyRevision === 2,
  )

  const tailStart = tail.at(-1)!.position
  const lastPage = await readAs<PageRead>(authorId, 'GetConversationMessagesBefore', {
    ...conversation(conversations.checked),
    beforePosition: tailStart,
  })

  check(
    'the page below the tail reads what is left',
    lastPage.conversationMessages.length === tailStart && lastPage.conversationMessages.at(-1)?.position === 0,
  )

  const othersPage = await readAs<PageRead>(authorId, 'GetConversationMessagesBefore', {
    ...conversation(conversations.members),
    beforePosition: 10,
  })

  check(
    "another member's history reads nothing",
    othersPage.conversations.length === 0 && othersPage.conversationMessages.length === 0,
  )

  // Bodies, by id
  const wantedIds = [messageIds.get(latestPosition)!, messageIds.get(0)!, membersMessageId]
  const bodies = await readAs<{ conversationMessages: Message[] }>(authorId, 'GetConversationMessageBodies', {
    ...conversation(conversations.checked),
    messageIds: wantedIds,
  })

  check(
    "bodies read the conversation's own messages by id, and nothing of another's",
    bodies.conversationMessages.length === 2
      && bodies.conversationMessages.every(({ id, text }) => id !== membersMessageId && typeof text === 'string'),
  )

  const crossed = await readAs<{ conversationMessages: Message[] }>(authorId, 'GetConversationMessageBodies', {
    ...conversation(conversations.members),
    messageIds: wantedIds,
  })

  check("bodies asked for under another member's conversation read nothing", crossed.conversationMessages.length === 0)

  // The latest run, and a tool call
  const runs = await readAs<{ conversationRuns: { number: number }[] }>(authorId, 'GetConversationRun', {
    organizationId,
    conversationId: conversations.checked,
  })

  check(
    'the run read is the latest by number',
    runs.conversationRuns.length === 1 && runs.conversationRuns[0]?.number === 2,
  )

  type ToolCallRead = { conversationMessages: { toolInput: string | null; toolOutput: string | null }[] }

  const toolCall = await readAs<ToolCallRead>(authorId, 'GetConversationToolCall', {
    organizationId,
    messageId: messageIds.get(toolCallPosition),
  })

  check(
    'a tool call reads its input and output as they were stored',
    toolCall.conversationMessages[0]?.toolInput === '{"query":"pricing"}'
      && toolCall.conversationMessages[0]?.toolOutput === '{"results":[]}',
  )

  const notToolCall = await readAs<ToolCallRead>(authorId, 'GetConversationToolCall', {
    organizationId,
    messageId: messageIds.get(0),
  })
  const othersToolCall = await readAs<ToolCallRead>(memberId, 'GetConversationToolCall', {
    organizationId,
    messageId: messageIds.get(toolCallPosition),
  })

  check(
    "a message that is not a call, and another member's call, read nothing",
    notToolCall.conversationMessages.length === 0 && othersToolCall.conversationMessages.length === 0,
  )

  // Marking read
  const marked = (userId: string, previewMessageId: string) => ({
    organizationId,
    userId,
    id: conversations.checked,
    previewMessageId,
  })

  check(
    'marking read with a reply that is no longer the latest goes through and clears nothing',
    (await runAs(authorId, 'MarkConversationRead', marked(authorId, messageIds.get(0)!)))
      && (await readConversation(conversations.checked))?.unreadCount === 3,
  )
  check(
    "a `$userId` other than the caller's is refused, and so is somebody outside",
    !(await runAs(authorId, 'MarkConversationRead', marked(memberId, messageIds.get(latestPosition)!)))
      && !(await runAs(outsiderId, 'MarkConversationRead', marked(outsiderId, messageIds.get(latestPosition)!))),
  )

  const before = await readConversation(conversations.checked)

  check(
    'marking read with the latest reply clears the count, and leaves the time alone',
    (await runAs(authorId, 'MarkConversationRead', marked(authorId, messageIds.get(latestPosition)!)))
      && (await readConversation(conversations.checked))?.unreadCount === 0
      && (await readConversation(conversations.checked))?.updatedAt === before?.updatedAt,
  )

  // Changing the aspects
  const tagged = (userId: string, id: string, position: number, aspects = ['STRATEGY', 'FINANCES']) => ({
    organizationId,
    userId,
    id,
    aspects,
    position,
  })
  const next = latestPosition + 1

  check(
    "aspects at the counter are set as the member's, with their note at that position",
    (await runAs(authorId, 'UpdateConversationAspects', tagged(authorId, conversations.checked, next)))
      && (await readMessageKindAt(conversations.checked, next)) === 'ASPECTS',
  )

  const after = await readConversation(conversations.checked)

  check(
    'the note moves the counter and the count on by one, and leaves the time alone',
    after?.nextMessagePosition === next + 1
      && after.messageCount === MESSAGE_POSITIONS.length + 1
      && after.aspectsSetBy === 'MEMBER'
      && after.aspects.length === 2
      && after.updatedAt === before?.updatedAt,
  )
  check(
    'aspects at a position another write took first are refused',
    !(await runAs(authorId, 'UpdateConversationAspects', tagged(authorId, conversations.checked, next))),
  )
  check(
    'an aspect twice is refused',
    !(await runAs(
      authorId,
      'UpdateConversationAspects',
      tagged(authorId, conversations.checked, next + 1, ['STRATEGY', 'STRATEGY']),
    )),
  )
  check(
    `a conversation holding ${MAX_CONVERSATION_MESSAGES} entries takes no note`,
    !(await runAs(
      authorId,
      'UpdateConversationAspects',
      tagged(authorId, conversations.full, MAX_CONVERSATION_MESSAGES),
    )),
  )
  check(
    "a deleted conversation, another member's, a `$userId` other than the caller's and somebody outside are refused",
    !(await runAs(authorId, 'UpdateConversationAspects', tagged(authorId, conversations.deleted, 0)))
      && !(await runAs(authorId, 'UpdateConversationAspects', tagged(authorId, conversations.members, 1)))
      && !(await runAs(authorId, 'UpdateConversationAspects', tagged(memberId, conversations.checked, next + 1)))
      && !(await runAs(outsiderId, 'UpdateConversationAspects', tagged(outsiderId, conversations.checked, next + 1))),
  )

  // A member removed reads nothing of what they wrote
  await write(
    `mutation Remove($authorId: String!, $organizationId: UUID!) {
      userOrganization_delete(key: { userId: $authorId, organizationId: $organizationId })
    }`,
    { authorId, organizationId },
  )

  const removed = await readAs<ConversationRead>(authorId, 'GetConversation', conversation(conversations.checked))
  const removedRuns = await readAs<{ conversationRuns: unknown[] }>(authorId, 'GetConversationRun', {
    organizationId,
    conversationId: conversations.checked,
  })

  check(
    'a member removed from the organization reads nothing of their conversation',
    removed.conversations.length === 0 && removedRuns.conversationRuns.length === 0,
  )
}

try {
  await setUp()
  await runChecks()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')
