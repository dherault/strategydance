import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  claimQueuedConversationRun,
  connectorConfig,
  drawConversationAgentText,
  expireQueuedConversationRunLease,
  finishConversationRun,
  finishConversationRunWithNote,
  getConversationRunContext,
  getConversationSendContext,
  interruptConversationRun,
  interruptDeadConversationRun,
  reclaimConversationRun,
  renewConversationRunLease,
  renewQueuedConversationRunLease,
  sendConversationMessage,
  startConversation,
  storeConversationTurn,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the backend's conversation operations against the emulators, where CI cannot, since what
  they guard is in their SQL conditions:

    bun run check:conversation-runs

  It makes a throwaway organization with a few members, starts, sends, claims, draws, finishes and
  finalizes runs through the backend connector's own operations, as the backend calls them, and
  removes everything it made, then exits non-zero naming each check that failed. The domain's tests
  run against a fake of these operations: this is what says the fake's conditions are the SQL's.

  Like `checkConversationPage.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:conversation-runs`',
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

// One account per group of checks, so the runs one leaves in flight never count against another's
const userIds = {
  author: `check-conversation-runs-${checkId}-author`,
  member: `check-conversation-runs-${checkId}-member`,
  sender: `check-conversation-runs-${checkId}-sender`,
  racer: `check-conversation-runs-${checkId}-racer`,
  hoarder: `check-conversation-runs-${checkId}-hoarder`,
  pruner: `check-conversation-runs-${checkId}-pruner`,
  queuer: `check-conversation-runs-${checkId}-queuer`,
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

type StoredConversation = {
  activeRunId: string | null
  nextMessagePosition: number
  nextRunNumber: number
  messageCount: number
  unreadCount: number
  preview: unknown
  previewMessageId: string | null
  deletedAt: string | null
}

async function readConversation(id: string) {
  const data = await read<{ conversation: StoredConversation | null }>(
    `query ReadConversation($id: UUID!) {
      conversation(id: $id) { activeRunId nextMessagePosition nextRunNumber messageCount unreadCount preview previewMessageId deletedAt }
    }`,
    { id },
  )

  return data.conversation
}

type StoredRun = {
  status: string
  attempts: number
  step: string | null
  leaseExpiresAt: string | null
  startedAt: string | null
  endedAt: string | null
}

async function readRun(id: string) {
  const data = await read<{ conversationRun: StoredRun | null }>(
    `query ReadRun($id: UUID!) {
      conversationRun(id: $id) { status attempts step leaseExpiresAt startedAt endedAt }
    }`,
    { id },
  )

  return data.conversationRun
}

async function readMessageAt(conversationId: string, position: number) {
  const data = await read<{ conversationMessages: { id: string; kind: string; noteKind: string | null }[] }>(
    `query ReadMessageAt($conversationId: UUID!, $position: Int!) {
      conversationMessages(where: { conversationId: { eq: $conversationId }, position: { eq: $position } }) { id kind noteKind }
    }`,
    { conversationId, position },
  )

  return data.conversationMessages[0] ?? null
}

// Moves a run's lease a second into the past, as a worker that stopped renewing it leaves it
async function expireLease(runId: string) {
  await write(
    `mutation ExpireLease($id: UUID!) {
      conversationRun_update(id: $id, data: { leaseExpiresAt_time: { now: true, sub: { seconds: 1 } } })
    }`,
    { id: runId },
  )
}

async function readMembershipCreatedAt(userId: string) {
  const { data } = await getConversationSendContext(dataConnect, {
    organizationId,
    userId,
    conversationId: createId(),
    messageId: createId(),
  })

  if (!data.userOrganization) throw new Error(`${userId} is not a member`)

  return data.userOrganization.createdAt
}

type Started = {
  userId: string
  membershipCreatedAt: string
  conversationId: string
  messageId: string
  runId: string
}

// Starts a conversation as the backend does, and answers what it made
async function start(userId: string, membershipCreatedAt: string, overrides: Partial<Started> = {}) {
  const started: Started = {
    userId,
    membershipCreatedAt,
    conversationId: createId(),
    messageId: createId(),
    runId: createId(),
    ...overrides,
  }

  await startConversation(dataConnect, {
    ...started,
    organizationId,
    title: 'Checked conversation',
    text: 'Checked message',
    preview: { kind: 'MEMBER_TEXT', text: 'Checked message' },
    content: JSON.stringify([{ type: 'text', text: 'Checked message' }]),
  })

  return started
}

// The variables every fenced write of the worker that claimed a run takes
function fence(started: Started, attempts: number) {
  return {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
    runId: started.runId,
    attempts,
    membershipCreatedAt: started.membershipCreatedAt,
  }
}

// Claims a queued run and completes it at once, which leaves its conversation idle
async function complete(started: Started) {
  await claimQueuedConversationRun(dataConnect, fence(started, 0))
  await finishConversationRun(dataConnect, { ...fence(started, 1), status: ConversationRunStatus.COMPLETED })
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
    `mutation SetUp($organizationId: UUID!) {
      organization_insert(data: { id: $organizationId, name: "Checked organization" })
    }`,
    { organizationId },
  )

  for (const userId of Object.values(userIds)) {
    await write(
      `mutation AddMember($organizationId: UUID!, $userId: String!) {
        userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: MEMBER })
      }`,
      { organizationId, userId },
    )
  }
}

async function tearDown() {
  await write(
    `mutation TearDown($organizationId: UUID!, $ids: [String!]!) {
      organization_delete(id: $organizationId)
      user_deleteMany(where: { id: { in: $ids } })
    }`,
    { organizationId, ids: Object.values(userIds) },
  )
}

async function checkStarting() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.author)
  const startedFailure = await refusal(start(userIds.author, membershipCreatedAt))

  check('a membership’s `createdAt`, read back, matches itself in a filter', startedFailure === null)

  check(
    'starting refuses a membership other than the one read',
    (await refusal(start(userIds.author, '2020-01-01T00:00:00Z')))?.startsWith('The membership changed') ?? false,
  )

  const started = await start(userIds.sender, await readMembershipCreatedAt(userIds.sender))
  const conversation = await readConversation(started.conversationId)
  const run = await readRun(started.runId)
  const { data } = await getConversationRunContext(dataConnect, {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
    runId: started.runId,
  })
  const leaseMinutes = run?.leaseExpiresAt ? (Date.parse(run.leaseExpiresAt) - Date.now()) / 60000 : 0

  check(
    'starting stores the conversation naming its queued run, with its message and first entry',
    conversation?.activeRunId === started.runId
      && conversation.nextMessagePosition === 1
      && conversation.nextRunNumber === 1
      && conversation.messageCount === 1
      && conversation.previewMessageId === started.messageId
      && run?.status === ConversationRunStatus.QUEUED
      && leaseMinutes > 19
      && leaseMinutes <= 20
      && data.conversationTranscriptEntries[0]?.position === 0
      && data.conversationTranscriptEntries[0]?.role === 'USER',
  )
  check(
    'starting refuses a conversation that exists',
    (await refusal(start(userIds.sender, started.membershipCreatedAt, { conversationId: started.conversationId })))
      !== null,
  )
  check(
    'starting refuses a message sent already',
    (await refusal(start(userIds.sender, started.membershipCreatedAt, { messageId: started.messageId }))) !== null,
  )

  return started
}

async function checkClaiming(started: Started) {
  check(
    'a queued run is claimed once',
    (await claimQueuedConversationRun(dataConnect, fence(started, 0))).data.conversationRun_updateMany === 1,
  )

  const claimed = await readRun(started.runId)

  check(
    'claiming sets the run going, with its first attempt, a minute’s lease and when it started',
    claimed?.status === ConversationRunStatus.RUNNING
      && claimed.attempts === 1
      && Boolean(claimed.startedAt)
      && Boolean(claimed.leaseExpiresAt)
      && Date.parse(claimed.leaseExpiresAt ?? '') - Date.now() <= 60000,
  )
  check(
    'a run claimed already is not claimed twice',
    (await claimQueuedConversationRun(dataConnect, fence(started, 0))).data.conversationRun_updateMany === 0,
  )
  check(
    'a run whose lease is alive is not taken over',
    (await reclaimConversationRun(dataConnect, fence(started, 1))).data.conversationRun_updateMany === 0,
  )

  await renewConversationRunLease(dataConnect, { ...fence(started, 1), step: 'Reading your message' })
  await renewConversationRunLease(dataConnect, fence(started, 1))

  check(
    'a renewal without a step keeps the one before',
    (await readRun(started.runId))?.step === 'Reading your message',
  )

  await expireLease(started.runId)

  check(
    'a run past its lease is taken over, with one more attempt',
    (await reclaimConversationRun(dataConnect, fence(started, 1))).data.conversationRun_updateMany === 1
      && (await readRun(started.runId))?.attempts === 2,
  )
  check(
    'the worker that lost the run renews nothing more',
    (await renewConversationRunLease(dataConnect, fence(started, 1))).data.conversationRun_updateMany === 0,
  )

  // Keys out of alphabetical order, as a model writes them, and U+0000, which `jsonb` would refuse
  const content = JSON.stringify([
    { type: 'text', text: 'Before\u0000after' },
    { type: 'tool_use', id: 'toolu_1', name: 'read_knowledge', input: { zebra: 1, apple: { b: 2, a: 1 } } },
  ])
  const entryId = createId()

  check(
    'the worker that lost the run stores nothing more',
    (await refusal(storeConversationTurn(dataConnect, { ...fence(started, 1), entryId, position: 1, content })))
      !== null,
  )

  await storeConversationTurn(dataConnect, { ...fence(started, 2), entryId, position: 1, content })

  const { data } = await getConversationRunContext(dataConnect, {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
    runId: started.runId,
  })

  check(
    'a turn holding U+0000 and keys out of order is stored and read back as the same bytes',
    data.conversationTranscriptEntries[0]?.id === entryId && data.conversationTranscriptEntries[0]?.content === content,
  )

  const draw = {
    ...fence(started, 2),
    entryId,
    fromBlock: 0,
    toBlock: 1,
    messageId: createId(),
    position: 1,
    text: 'Before after',
    preview: { kind: 'AGENT_TEXT', text: 'Before after' },
  }

  check('a reply is drawn at the counter', (await refusal(drawConversationAgentText(dataConnect, draw))) === null)

  const conversation = await readConversation(started.conversationId)

  check(
    'drawing a reply counts it unread and makes it the preview',
    conversation?.nextMessagePosition === 2
      && conversation.messageCount === 2
      && conversation.unreadCount === 1
      && conversation.previewMessageId === draw.messageId,
  )
  check(
    'blocks drawn already are not drawn again',
    (await refusal(drawConversationAgentText(dataConnect, { ...draw, messageId: createId(), position: 2 }))) !== null
      && (await readConversation(started.conversationId))?.nextMessagePosition === 2,
  )
  check(
    'a reply is not drawn at a position the counter has passed',
    (await refusal(
      drawConversationAgentText(dataConnect, { ...draw, fromBlock: 1, toBlock: 2, messageId: createId(), position: 1 }),
    )) !== null,
  )
  check(
    'a run does not end as still going',
    (await refusal(finishConversationRun(dataConnect, { ...fence(started, 2), status: ConversationRunStatus.RUNNING })))
      !== null,
  )

  await finishConversationRun(dataConnect, { ...fence(started, 2), status: ConversationRunStatus.COMPLETED })

  const finished = await readRun(started.runId)

  check(
    'finishing ends the run and lets its conversation go',
    finished?.status === ConversationRunStatus.COMPLETED
      && Boolean(finished.endedAt)
      && finished.leaseExpiresAt === null
      && (await readConversation(started.conversationId))?.activeRunId === null,
  )
}

async function checkFinishing() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.author)
  const other = await start(userIds.author, membershipCreatedAt)
  const otherRunId = createId()

  await claimQueuedConversationRun(dataConnect, fence(other, 0))
  await write(
    `mutation NameAnotherRun($id: UUID!, $runId: UUID!) {
      conversation_update(id: $id, data: { activeRunId: $runId })
    }`,
    { id: other.conversationId, runId: otherRunId },
  )
  await finishConversationRun(dataConnect, { ...fence(other, 1), status: ConversationRunStatus.COMPLETED })

  check(
    'finishing a run leaves a conversation naming another run alone',
    (await readConversation(other.conversationId))?.activeRunId === otherRunId,
  )

  const deleted = await start(userIds.author, membershipCreatedAt)

  await claimQueuedConversationRun(dataConnect, fence(deleted, 0))
  await write(
    `mutation DeleteConversation($id: UUID!) {
      conversation_update(id: $id, data: { deletedAt_expr: "request.time" })
    }`,
    { id: deleted.conversationId },
  )

  check(
    'a reply is not drawn into a deleted conversation',
    (await refusal(
      drawConversationAgentText(dataConnect, {
        ...fence(deleted, 1),
        entryId: createId(),
        fromBlock: 0,
        toBlock: 1,
        messageId: createId(),
        position: 1,
        text: 'Too late',
        preview: { kind: 'AGENT_TEXT', text: 'Too late' },
      }),
    )) !== null,
  )

  await finishConversationRun(dataConnect, { ...fence(deleted, 1), status: ConversationRunStatus.STOPPED })

  check(
    'a run in a deleted conversation is let go of, so the conversation is idle once restored',
    (await readConversation(deleted.conversationId))?.activeRunId === null,
  )

  const full = await start(userIds.author, membershipCreatedAt)

  await claimQueuedConversationRun(dataConnect, fence(full, 0))
  await write(
    `mutation FillConversation($id: UUID!) {
      conversation_update(id: $id, data: { messageCount: 2000 })
    }`,
    { id: full.conversationId },
  )

  const noteId = createId()

  await finishConversationRunWithNote(dataConnect, {
    ...fence(full, 1),
    status: ConversationRunStatus.FAILED,
    noteKind: ConversationNoteKind.FULL,
    noteId,
    position: 1,
    preview: { kind: 'NOTE', noteKind: 'FULL' },
  })

  const conversation = await readConversation(full.conversationId)

  check(
    'a run ending with a note takes it past the 2000, at the counter, and lets go',
    conversation?.activeRunId === null
      && conversation.messageCount === 2001
      && conversation.previewMessageId === noteId
      && (await readMessageAt(full.conversationId, 1))?.noteKind === ConversationNoteKind.FULL
      && (await readRun(full.runId))?.status === ConversationRunStatus.FAILED,
  )
}

async function checkMembership() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.member)
  const claimed = await start(userIds.member, membershipCreatedAt)
  const queued = await start(userIds.member, membershipCreatedAt)

  await claimQueuedConversationRun(dataConnect, fence(claimed, 0))
  await write(
    `mutation RemoveMember($organizationId: UUID!, $userId: String!) {
      userOrganization_delete(key: { userId: $userId, organizationId: $organizationId })
    }`,
    { organizationId, userId: userIds.member },
  )

  check(
    'a removed member’s run renews nothing more',
    (await renewConversationRunLease(dataConnect, fence(claimed, 1))).data.conversationRun_updateMany === 0,
  )

  await write(
    `mutation InviteBack($organizationId: UUID!, $userId: String!) {
      userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: MEMBER })
    }`,
    { organizationId, userId: userIds.member },
  )

  check(
    'a member invited back does not pass for the one who started a run',
    (await renewConversationRunLease(dataConnect, fence(claimed, 1))).data.conversationRun_updateMany === 0
      && (await claimQueuedConversationRun(dataConnect, fence(queued, 0))).data.conversationRun_updateMany === 0,
  )

  for (const [started, attempts] of [
    [claimed, 1],
    [queued, 0],
  ] as const) {
    await interruptConversationRun(dataConnect, {
      organizationId,
      userId: started.userId,
      conversationId: started.conversationId,
      runId: started.runId,
      attempts,
      noteId: createId(),
      position: 1,
      preview: { kind: 'NOTE', noteKind: 'INTERRUPTED' },
    })
  }

  check(
    'a run whose member is gone is interrupted, claimed or queued, with its note',
    (await readRun(claimed.runId))?.status === ConversationRunStatus.INTERRUPTED
      && (await readRun(queued.runId))?.status === ConversationRunStatus.INTERRUPTED
      && (await readConversation(claimed.conversationId))?.activeRunId === null
      && (await readConversation(queued.conversationId))?.activeRunId === null
      && (await readMessageAt(queued.conversationId, 1))?.noteKind === ConversationNoteKind.INTERRUPTED,
  )
}

async function checkDeadRuns() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.author)
  const started = await start(userIds.author, membershipCreatedAt)
  const interrupt = {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
    runId: started.runId,
    noteId: createId(),
    position: 1,
    preview: { kind: 'NOTE', noteKind: 'INTERRUPTED' },
  }

  check(
    'a run whose lease is alive is not finalized',
    (await refusal(interruptDeadConversationRun(dataConnect, interrupt))) !== null,
  )

  await expireLease(started.runId)
  await interruptDeadConversationRun(dataConnect, interrupt)

  check(
    'a run past its lease is finalized as interrupted, with its note',
    (await readRun(started.runId))?.status === ConversationRunStatus.INTERRUPTED
      && (await readConversation(started.conversationId))?.activeRunId === null
      && (await readMessageAt(started.conversationId, 1))?.noteKind === ConversationNoteKind.INTERRUPTED,
  )
}

/*
  A queued run's lease, which the backend pushes back once it has seen the run's task still in the
  queue, and brings in to now when the task could not be queued, so the page reconciles it at once
*/
async function checkQueuedLeases() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.queuer)
  const started = await start(userIds.queuer, membershipCreatedAt)
  const reference = {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
    runId: started.runId,
  }
  const readLease = async () => Date.parse((await readRun(started.runId))?.leaseExpiresAt ?? '')
  const queuedLease = await readLease()

  const { data: strangers } = await expireQueuedConversationRunLease(dataConnect, {
    ...reference,
    userId: userIds.member,
  })
  const { data: elsewhere } = await expireQueuedConversationRunLease(dataConnect, {
    ...reference,
    conversationId: createId(),
  })

  check(
    'a queued run’s lease is not brought in for another member, nor in another conversation',
    strangers.conversationRun_updateMany === 0
      && elsewhere.conversationRun_updateMany === 0
      && (await readLease()) === queuedLease,
  )

  const { data: context } = await getConversationRunContext(dataConnect, reference)
  const createdAt = Date.parse(context.conversationRuns[0]?.createdAt ?? '')

  check(
    'a run’s context says when it was queued, which says whether its lost task is queued again',
    createdAt <= Date.now() && createdAt > Date.now() - 60 * 1000,
  )

  await expireLease(started.runId)

  const { data: strangerRenewal } = await renewQueuedConversationRunLease(dataConnect, {
    ...reference,
    userId: userIds.member,
  })
  const { data: renewed } = await renewQueuedConversationRunLease(dataConnect, reference)

  check(
    'a queued run’s lease past is pushed twenty minutes out again, for its author alone',
    strangerRenewal.conversationRun_updateMany === 0
      && renewed.conversationRun_updateMany === 1
      && (await readLease()) > Date.now() + 19 * 60 * 1000,
  )

  const { data: expired } = await expireQueuedConversationRunLease(dataConnect, reference)

  check(
    'a queued run’s lease is brought in to now, and the run stays queued',
    expired.conversationRun_updateMany === 1
      && (await readLease()) <= Date.now()
      && (await readRun(started.runId))?.status === ConversationRunStatus.QUEUED,
  )

  await claimQueuedConversationRun(dataConnect, fence(started, 0))

  const claimedLease = await readLease()
  const { data: claimed } = await expireQueuedConversationRunLease(dataConnect, reference)

  const { data: claimedRenewal } = await renewQueuedConversationRunLease(dataConnect, reference)

  check(
    'a claimed run’s lease is neither brought in nor pushed back as a queued one’s',
    claimed.conversationRun_updateMany === 0
      && claimedRenewal.conversationRun_updateMany === 0
      && (await readLease()) === claimedLease,
  )

  await finishConversationRun(dataConnect, { ...fence(started, 1), status: ConversationRunStatus.COMPLETED })
}

async function checkSending(started: Started) {
  const send = (overrides: Variables = {}) =>
    sendConversationMessage(dataConnect, {
      organizationId,
      userId: started.userId,
      conversationId: started.conversationId,
      membershipCreatedAt: started.membershipCreatedAt,
      messageId: createId(),
      text: 'Another message',
      preview: { kind: 'MEMBER_TEXT', text: 'Another message' },
      position: 2,
      runId: createId(),
      runNumber: 1,
      content: '[]',
      transcriptPosition: 2,
      ...overrides,
    })
  const runId = createId()

  check('an idle conversation takes a message', (await refusal(send({ runId }))) === null)
  check(
    'a conversation with a run going takes no message',
    (await refusal(send({ position: 3, runNumber: 2, transcriptPosition: 3 }))) !== null,
  )

  await complete({ ...started, runId })

  check(
    'a message is not sent at a position the counter has passed',
    (await refusal(send({ runNumber: 2, transcriptPosition: 3 }))) !== null,
  )

  const next = { position: 3, runNumber: 2, transcriptPosition: 3 }

  for (const [name, data, undo] of [
    ['a conversation of 2000 messages', 'messageCount: 2000', 'messageCount: 3'],
    ['a conversation marked full', 'isFull: true', 'isFull: false'],
    ['a deleted conversation', 'deletedAt_expr: "request.time"', 'deletedAt: null'],
  ] as const) {
    await write(`mutation Set($id: UUID!) { conversation_update(id: $id, data: { ${data} }) }`, {
      id: started.conversationId,
    })

    check(`${name} takes no message`, (await refusal(send(next))) !== null)

    await write(`mutation Undo($id: UUID!) { conversation_update(id: $id, data: { ${undo} }) }`, {
      id: started.conversationId,
    })
  }
}

async function checkCaps() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.racer)
  const idle = [await start(userIds.racer, membershipCreatedAt), await start(userIds.racer, membershipCreatedAt)]

  for (const started of idle) await complete(started)

  await start(userIds.racer, membershipCreatedAt)
  await start(userIds.racer, membershipCreatedAt)

  // Two runs in flight: two sends at once from two idle conversations, for the one place left
  const outcomes = await Promise.all(
    idle.map(started =>
      refusal(
        sendConversationMessage(dataConnect, {
          organizationId,
          userId: started.userId,
          conversationId: started.conversationId,
          membershipCreatedAt,
          messageId: createId(),
          text: 'At once',
          preview: { kind: 'MEMBER_TEXT', text: 'At once' },
          position: 1,
          runId: createId(),
          runNumber: 1,
          content: '[]',
          transcriptPosition: 1,
        }),
      ),
    ),
  )

  check(
    'two sends at once with two runs in flight let exactly one through',
    outcomes.filter(outcome => outcome === null).length === 1,
  )
  check(
    'a fourth run in flight is refused',
    (await refusal(start(userIds.racer, membershipCreatedAt)))?.includes('at most 3 runs') ?? false,
  )

  const hoarderCreatedAt = await readMembershipCreatedAt(userIds.hoarder)
  const rows = Array.from({ length: 999 }, () => ({
    id: createId(),
    userId: userIds.hoarder,
    organizationId,
    title: 'Kept',
  }))

  // In batches of 100, the most one insert takes
  for (let index = 0; index < rows.length; index += 100) {
    await write(
      `mutation InsertConversations($rows: [Conversation_Data!]!) {
        conversation_insertMany(data: $rows)
      }`,
      { rows: rows.slice(index, index + 100) },
    )
  }

  check('the thousandth conversation is started', (await refusal(start(userIds.hoarder, hoarderCreatedAt))) === null)
  check(
    'a conversation past the thousand is refused',
    (await refusal(start(userIds.hoarder, hoarderCreatedAt)))?.includes('at most 1000') ?? false,
  )
}

async function checkPruning() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.pruner)
  const insertDeleted = async (days: number, hours: number) => {
    const id = createId()

    await write(
      `mutation InsertDeleted($id: UUID!, $userId: String!, $organizationId: UUID!, $days: Int!, $hours: Int!) {
        conversation_insert(data: { id: $id, userId: $userId, organizationId: $organizationId, title: "Deleted", deletedAt_time: { now: true, sub: { days: $days, hours: $hours } } })
      }`,
      { id, userId: userIds.pruner, organizationId, days, hours },
    )

    return id
  }
  const old = await insertDeleted(2, 0)
  const recent = await insertDeleted(0, 1)

  await start(userIds.pruner, membershipCreatedAt)

  check(
    'starting removes what was deleted over a day ago, and keeps what can still be taken back',
    (await readConversation(old)) === null && (await readConversation(recent)) !== null,
  )

  const contested = await insertDeleted(2, 0)
  const [restored] = await Promise.all([
    refusal(
      webConnector.executeMutation(
        'RestoreConversation',
        { organizationId, userId: userIds.pruner, id: contested },
        { impersonate: { authClaims: { sub: userIds.pruner } } },
      ),
    ),
    refusal(start(userIds.pruner, membershipCreatedAt)),
  ])
  const remaining = await readConversation(contested)

  check(
    'a restore and a start at once either bring a conversation back or remove it, never half',
    restored === null ? remaining?.deletedAt === null : remaining === null,
  )
}

try {
  await setUp()

  const started = await checkStarting()

  await checkClaiming(started)
  await checkFinishing()
  await checkMembership()
  await checkDeadRuns()
  await checkQueuedLeases()
  // The claiming checks leave the sender's conversation idle, its next position 2 and its next run 1
  await checkSending(started)
  await checkCaps()
  await checkPruning()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')
