import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import { MAX_CONVERSATIONS } from 'strategydance-core'
import { connectorConfig } from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the conversations list's operations against the emulators, where CI cannot, since what
  they guard is in their SQL conditions:

    bun run check:conversation-list

  It makes a throwaway organization with two members and a thousand conversations, runs the web
  connector's own operations as those members, and removes everything it made, then exits non-zero
  naming each check that failed. The operations go through the Admin SDK impersonating a member, so
  their `@auth` level and every `@check` are evaluated as for that member's token.

  Like `grantAdministrator.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:conversation-list`',
  )
  process.exit(1)
}

/*
  The browser's connector, on the same service as the backend's. The Admin SDK keeps one instance a
  service and app, whatever its connector, so it takes an app of its own
*/
const webConnector = getDataConnect(
  { ...connectorConfig, connector: 'strategydance-web-connector' },
  initializeApp({ projectId: FIREBASE_PROJECT_ID }, 'web-connector'),
)

// Dashless, as the emulator writes a UUID back, so an id read compares with the one made
function createId() {
  return randomUUID().replaceAll('-', '')
}

const runId = createId().slice(0, 8)
const authorId = `check-conversations-${runId}-author`
const memberId = `check-conversations-${runId}-member`
const outsiderId = `check-conversations-${runId}-outsider`
const organizationId = createId()

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

async function countLive() {
  const { data } = await dataConnect.executeGraphql<{ conversations: { id: string }[] }, Variables>(
    `query CountLive($userId: String!, $organizationId: UUID!) {
      conversations(where: { userId: { eq: $userId }, organizationId: { eq: $organizationId }, deletedAt: { isNull: true } }, limit: 2000) { id }
    }`,
    { variables: { userId: authorId, organizationId } },
  )

  return data.conversations.length
}

// In batches of 100, the most one insert takes
async function insertConversations(rows: Variables[]) {
  for (let start = 0; start < rows.length; start += 100) {
    await write(
      `mutation InsertConversations($rows: [Conversation_Data!]!) {
        conversation_insertMany(data: $rows)
      }`,
      { rows: rows.slice(start, start + 100) },
    )
  }
}

function conversation(userId: string, fields: Variables = {}) {
  return { id: createId(), userId, organizationId, title: 'Checked conversation', ...fields }
}

const deletedAt = new Date().toISOString()

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

async function runChecks() {
  // The author keeps the most they may, the first waiting for an answer, and has two more deleted
  const first = conversation(authorId, { isAwaitingAnswer: true })
  const second = conversation(authorId)
  const third = conversation(authorId)
  const rest = Array.from({ length: MAX_CONVERSATIONS - 3 }, () => conversation(authorId))
  const deletedFirst = conversation(authorId, { deletedAt })
  const deletedSecond = conversation(authorId, { deletedAt })
  const claimed = conversation(authorId, { deletedAt, pruneClaimedAt: deletedAt })
  const membersDeleted = conversation(memberId, { deletedAt })
  const membersLive = conversation(memberId)

  await insertConversations([
    first,
    second,
    third,
    ...rest,
    deletedFirst,
    deletedSecond,
    claimed,
    membersDeleted,
    membersLive,
  ])

  const variables = (userId: string, id: string) => ({ organizationId, userId, id })

  const list = await readAs<{ conversations: { id: string }[] }>(authorId, 'GetConversations', { organizationId })

  check(
    `the list reads the author's ${MAX_CONVERSATIONS} live conversations, and no deleted one`,
    list.conversations.length === MAX_CONVERSATIONS && !list.conversations.some(({ id }) => id === deletedFirst.id),
  )

  const awaiting = await readAs<{ conversations: { id: string }[] }>(authorId, 'GetConversationsAwaitingAnswer', {
    organizationId,
  })

  check(
    'the waiting list reads the one conversation that waits',
    awaiting.conversations.length === 1 && awaiting.conversations[0]?.id === first.id,
  )

  const othersList = await readAs<{ conversations: { id: string }[] }>(memberId, 'GetConversations', {
    organizationId,
  })

  check(
    "another member's list holds their own conversation alone",
    othersList.conversations.length === 1 && othersList.conversations[0]?.id === membersLive.id,
  )

  check(
    'restoring at the cap is refused',
    !(await runAs(authorId, 'RestoreConversation', variables(authorId, deletedFirst.id))),
  )

  check('deleting goes through', await runAs(authorId, 'DeleteConversation', variables(authorId, first.id)))
  check(
    'deleting again goes through, changing nothing',
    await runAs(authorId, 'DeleteConversation', variables(authorId, first.id)),
  )
  check(
    'the waiting list drops a deleted conversation',
    (await readAs<{ conversations: unknown[] }>(authorId, 'GetConversationsAwaitingAnswer', { organizationId }))
      .conversations.length === 0,
  )
  check(
    'restoring under the cap goes through',
    await runAs(authorId, 'RestoreConversation', variables(authorId, deletedFirst.id)),
  )
  check(
    'restoring one that is not deleted is refused',
    !(await runAs(authorId, 'RestoreConversation', variables(authorId, deletedFirst.id))),
  )

  // One under the cap, with two deleted: only one of two restores at once may go through
  await runAs(authorId, 'DeleteConversation', variables(authorId, second.id))

  const restores = await Promise.all([
    runAs(authorId, 'RestoreConversation', variables(authorId, second.id)),
    runAs(authorId, 'RestoreConversation', variables(authorId, deletedSecond.id)),
  ])

  check(
    'two restores at once one under the cap let exactly one through',
    restores.filter(Boolean).length === 1 && (await countLive()) === MAX_CONVERSATIONS,
  )

  // Under the cap from here, so only the check under test can refuse
  await runAs(authorId, 'DeleteConversation', variables(authorId, third.id))

  check(
    'restoring one a prune has claimed is refused',
    !(await runAs(authorId, 'RestoreConversation', variables(authorId, claimed.id))),
  )
  check(
    "restoring another member's conversation is refused",
    !(await runAs(authorId, 'RestoreConversation', variables(authorId, membersDeleted.id))),
  )
  await runAs(authorId, 'DeleteConversation', variables(authorId, membersLive.id))

  const membersList = await readAs<{ conversations: { id: string }[] }>(memberId, 'GetConversations', {
    organizationId,
  })

  check(
    "deleting another member's conversation changes nothing",
    membersList.conversations.length === 1 && membersList.conversations[0]?.id === membersLive.id,
  )
  check(
    "a `$userId` other than the caller's is refused",
    !(await runAs(authorId, 'RestoreConversation', variables(memberId, third.id)))
      && !(await runAs(authorId, 'DeleteConversation', variables(memberId, second.id))),
  )
  check(
    'somebody outside the organization is refused',
    !(await runAs(outsiderId, 'DeleteConversation', variables(outsiderId, second.id)))
      && !(await runAs(outsiderId, 'RestoreConversation', variables(outsiderId, third.id))),
  )

  // A run in flight is asked to stop, and a run that ended is left alone
  const runs = { running: createId(), ended: createId() }

  await write(
    `mutation InsertRuns($conversationId: UUID!, $running: UUID!, $ended: UUID!, $membershipCreatedAt: Timestamp!) {
      running: conversationRun_insert(data: { id: $running, conversationId: $conversationId, number: 1, trigger: MESSAGE, status: RUNNING, membershipCreatedAt: $membershipCreatedAt, anchorPosition: 0 })
      ended: conversationRun_insert(data: { id: $ended, conversationId: $conversationId, number: 0, trigger: MESSAGE, status: COMPLETED, membershipCreatedAt: $membershipCreatedAt, anchorPosition: 0 })
    }`,
    { conversationId: second.id, ...runs, membershipCreatedAt: deletedAt },
  )
  await runAs(authorId, 'DeleteConversation', variables(authorId, second.id))

  const { data } = await dataConnect.executeGraphql<
    { running: { stopRequestedAt: string | null }; ended: { stopRequestedAt: string | null } },
    Variables
  >(
    `query ReadRuns($running: UUID!, $ended: UUID!) {
      running: conversationRun(id: $running) { stopRequestedAt }
      ended: conversationRun(id: $ended) { stopRequestedAt }
    }`,
    { variables: runs },
  )

  check(
    'deleting asks the run in flight to stop, and leaves an ended one alone',
    Boolean(data.running.stopRequestedAt) && !data.ended.stopRequestedAt,
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
