import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  answerConversationApproval,
  CompanyAspect,
  ConversationApprovalState,
  ConversationActor,
  ConversationNoteKind,
  ConversationRunStatus,
  answerConversationQuestion,
  claimDeletedConversations,
  claimQueuedConversationRun,
  connectorConfig,
  continueConversationRun,
  continueConversationRunWithCalls,
  deleteExpiredRunSpends,
  deleteClaimedConversations,
  deleteConversationModuleCallResults,
  ConversationToolStatus,
  drawConversationAgentText,
  drawConversationAgentTextPiece,
  drawConversationApproval,
  drawConversationClientToolCall,
  drawConversationQuestion,
  drawConversationToolCall,
  expireQueuedConversationRunLease,
  finishConversationRun,
  finishConversationRunWaiting,
  finishConversationIntegrationCall,
  finishConversationRunWithNote,
  finishConversationToolCall,
  getClaimedConversations,
  getConversationCalls,
  getConversationRequestContext,
  getConversationRetryContext,
  getConversationRunContext,
  getConversationRunControlContext,
  getConversationRunLedgers,
  getConversationRunStop,
  getConversationTranscript,
  getConversationSendContext,
  getConversationTurnContext,
  getCappedStarts,
  getDailySpend,
  getDailySpendRows,
  getRunDailySpend,
  getConversationsSuspension,
  interruptConversationRun,
  interruptDeadConversationRun,
  liftOrganizationConversationsSuspension,
  liftUserConversationsSuspension,
  reclaimConversationRun,
  recordConversationRunUsage,
  renewConversationRunLease,
  renewQueuedConversationRunLease,
  requestConversationRunStop,
  resumeConversationRun,
  retryConversationRun,
  sendConversationMessage,
  sendConversationMessageAnsweringCalls,
  settleConversationToolCall,
  startConversation,
  startConversationIntegrationCall,
  startConversationToolCall,
  stopQueuedConversationRun,
  storeConversationTurn,
  storeConversationToolResults,
  storeConversationTurnWithContext,
  suspendOrganizationConversations,
  suspendUserConversations,
  tagConversationAspects,
} from 'strategydance-database/backend'

import { CONVERSATION_RUN_QUEUED_LEASE_MS, FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the backend's conversation operations against the emulators, where CI cannot, since what
  they guard is in their SQL conditions:

    bun run check:conversation-runs

  It makes a throwaway organization with a few members, starts, sends, claims, draws, finishes and
  finalizes runs through the backend connector's own operations, as the backend calls them, and
  removes everything it made, then exits non-zero naming each check that failed. The domain's tests
  run against a fake of these operations: this is what says the fake's conditions are the SQL's.

  The daily sweep's operations take no organization: they reach every conversation in the emulator
  deleted over a day ago, whoever's it is, which the next sweep would prune anyway.

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
// A second organization, which the suspension's checks suspend whole without asking the runs the
// other checks leave in flight in the first to stop
const suspendedOrganizationId = createId()

// One account per group of checks, so the runs one leaves in flight never count against another's
const userIds = {
  author: `check-conversation-runs-${checkId}-author`,
  member: `check-conversation-runs-${checkId}-member`,
  sender: `check-conversation-runs-${checkId}-sender`,
  racer: `check-conversation-runs-${checkId}-racer`,
  hoarder: `check-conversation-runs-${checkId}-hoarder`,
  pruner: `check-conversation-runs-${checkId}-pruner`,
  queuer: `check-conversation-runs-${checkId}-queuer`,
  sweeper: `check-conversation-runs-${checkId}-sweeper`,
  drawer: `check-conversation-runs-${checkId}-drawer`,
  stopper: `check-conversation-runs-${checkId}-stopper`,
  resumer: `check-conversation-runs-${checkId}-resumer`,
  retrier: `check-conversation-runs-${checkId}-retrier`,
  asker: `check-conversation-runs-${checkId}-asker`,
  settler: `check-conversation-runs-${checkId}-settler`,
  tagger: `check-conversation-runs-${checkId}-tagger`,
  integrator: `check-conversation-runs-${checkId}-integrator`,
  approver: `check-conversation-runs-${checkId}-approver`,
  capper: `check-conversation-runs-${checkId}-capper`,
  traveler: `check-conversation-runs-${checkId}-traveler`,
  organizer: `check-conversation-runs-${checkId}-organizer`,
  teammate: `check-conversation-runs-${checkId}-teammate`,
  suspended: `check-conversation-runs-${checkId}-suspended`,
  bystander: `check-conversation-runs-${checkId}-bystander`,
  spender: `check-conversation-runs-${checkId}-spender`,
  cosigner: `check-conversation-runs-${checkId}-cosigner`,
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

// Whether two JSON values are the same whatever their keys' order, since an `Any` column is
// Postgres `jsonb`, which gives its keys back in an order of its own
function isSameJson(a: unknown, b: unknown) {
  const sorted = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sorted)
      : value !== null && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
              .map(([key, item]) => [key, sorted(item)]),
          )
        : value

  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))
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

// Whether an operation was refused for the cause named, printing any other cause it was refused for
async function isRefused(operation: Promise<unknown>, cause: string) {
  const actual = await refusal(operation)

  if (actual !== null && !actual.includes(cause)) console.log(`        refused otherwise: ${actual}`)

  return actual?.includes(cause) ?? false
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

// Starts a conversation as the backend does, with the aspects its member picked on the draft when
// there are, and answers what it made
async function start(
  userId: string,
  membershipCreatedAt: string,
  overrides: Partial<Started> = {},
  drafted: { aspects?: CompanyAspect[]; aspectsSetBy?: ConversationActor } = {},
) {
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
    ...drafted,
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
    `mutation TearDown($organizationId: UUID!, $suspendedOrganizationId: UUID!, $ids: [String!]!) {
      organization_delete(id: $organizationId)
      suspended: organization_deleteMany(where: { id: { eq: $suspendedOrganizationId } })
      user_deleteMany(where: { id: { in: $ids } })
    }`,
    { organizationId, suspendedOrganizationId, ids: Object.values(userIds) },
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
      && leaseMinutes > CONVERSATION_RUN_QUEUED_LEASE_MS / 60000 - 1
      && leaseMinutes <= CONVERSATION_RUN_QUEUED_LEASE_MS / 60000
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
    { type: 'tool_use', id: 'toolu_1', name: 'read_document', input: { zebra: 1, apple: { b: 2, a: 1 } } },
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
  await interruptDeadConversationRun(dataConnect, { ...interrupt, failure: 'Its worker stopped renewing its lease' })

  check(
    'a run past its lease is finalized as interrupted, with its note and why',
    (await readRun(started.runId))?.status === ConversationRunStatus.INTERRUPTED
      && (await readConversation(started.conversationId))?.activeRunId === null
      && (await readMessageAt(started.conversationId, 1))?.noteKind === ConversationNoteKind.INTERRUPTED
      && (
        await read<{ conversationRun: { failure: string | null } | null }>(
          `query ReadDeadFailure($id: UUID!) { conversationRun(id: $id) { failure } }`,
          { id: started.runId },
        )
      ).conversationRun?.failure === 'Its worker stopped renewing its lease',
  )
}

/*
  Stopping a run as its member asks: a queued one at once, with its note, and a claimed one asked to
  stop, which its worker reads and ends
*/
async function checkStopping() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.stopper)
  const queued = await start(userIds.stopper, membershipCreatedAt)
  const queuedReference = {
    organizationId,
    userId: queued.userId,
    conversationId: queued.conversationId,
    runId: queued.runId,
  }
  const stopQueued = (reference: typeof queuedReference) =>
    stopQueuedConversationRun(dataConnect, {
      ...reference,
      noteId: createId(),
      position: 1,
      preview: { kind: 'NOTE', noteKind: 'STOPPED' },
    })

  check(
    'a queued run is not asked to stop, only a claimed one',
    (await requestConversationRunStop(dataConnect, queuedReference)).data.conversationRun_updateMany === 0,
  )

  await stopQueued(queuedReference)

  check(
    'a queued run stops at once, with its note and why, and lets its conversation go',
    (await readRun(queued.runId))?.status === ConversationRunStatus.STOPPED
      && (await readConversation(queued.conversationId))?.activeRunId === null
      && (await readMessageAt(queued.conversationId, 1))?.noteKind === ConversationNoteKind.STOPPED
      && (
        await read<{ conversationRun: { failure: string | null } | null }>(
          `query ReadFailure($id: UUID!) { conversationRun(id: $id) { failure } }`,
          { id: queued.runId },
        )
      ).conversationRun?.failure === 'Its member stopped it while it was queued',
  )
  check('a stopped run is not stopped again', (await refusal(stopQueued(queuedReference))) !== null)

  const claimed = await start(userIds.stopper, membershipCreatedAt)
  const claimedReference = {
    organizationId,
    userId: claimed.userId,
    conversationId: claimed.conversationId,
    runId: claimed.runId,
  }

  await claimQueuedConversationRun(dataConnect, fence(claimed, 0))

  check('a claimed run is not stopped as a queued one', (await refusal(stopQueued(claimedReference))) !== null)
  check(
    'a claimed run is asked to stop once',
    (await requestConversationRunStop(dataConnect, claimedReference)).data.conversationRun_updateMany === 1
      && (await requestConversationRunStop(dataConnect, claimedReference)).data.conversationRun_updateMany === 0,
  )

  const { data: asked } = await getConversationRunStop(dataConnect, claimedReference)
  const { data: unseen } = await getConversationRunStop(dataConnect, { ...claimedReference, userId: userIds.member })

  check(
    'its worker reads that it was asked, and nobody else reads its run',
    Boolean(asked.conversationRuns[0]?.stopRequestedAt) && unseen.conversationRuns.length === 0,
  )

  await finishConversationRunWithNote(dataConnect, {
    ...fence(claimed, 1),
    status: ConversationRunStatus.STOPPED,
    noteKind: ConversationNoteKind.STOPPED,
    noteId: createId(),
    position: 1,
    preview: { kind: 'NOTE', noteKind: 'STOPPED' },
    failure: 'Its member stopped it before its next request',
  })

  check(
    'a run its worker stops ends stopped, with its note',
    (await readRun(claimed.runId))?.status === ConversationRunStatus.STOPPED
      && (await readMessageAt(claimed.conversationId, 1))?.noteKind === ConversationNoteKind.STOPPED,
  )
}

/*
  Resuming a run from its note: the note goes, a run starts on the anchor of the one it resumes, and
  that run draws what the one it resumes stored and left undrawn
*/
async function checkResuming() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.resumer)
  const started = await start(userIds.resumer, membershipCreatedAt)
  const entryId = createId()
  const noteId = createId()

  await claimQueuedConversationRun(dataConnect, fence(started, 0))
  await storeConversationTurn(dataConnect, {
    ...fence(started, 1),
    entryId,
    position: 1,
    content: JSON.stringify([{ type: 'text', text: 'Stored, never drawn' }]),
  })
  await finishConversationRunWithNote(dataConnect, {
    ...fence(started, 1),
    status: ConversationRunStatus.STOPPED,
    noteKind: ConversationNoteKind.STOPPED,
    noteId,
    position: 1,
    preview: { kind: 'NOTE', noteKind: 'STOPPED' },
    failure: 'Its member stopped it before its next request',
  })

  const runId = createId()
  const resume = (overrides: Variables = {}) =>
    resumeConversationRun(dataConnect, {
      organizationId,
      userId: started.userId,
      conversationId: started.conversationId,
      membershipCreatedAt,
      resumedRunId: started.runId,
      resumedRunNumber: 0,
      anchorPosition: 0,
      noteId,
      notePosition: 1,
      nextMessagePosition: 2,
      preview: { kind: 'MEMBER_TEXT', text: 'Checked message' },
      previewMessageId: started.messageId,
      runId,
      runNumber: 1,
      ...overrides,
    })

  check(
    'a run resumes only the run right before it, from the newest message',
    (await refusal(resume({ runNumber: 2 }))) !== null && (await refusal(resume({ notePosition: 0 }))) !== null,
  )

  await write(
    `mutation AddAspects($conversationId: UUID!) {
      conversationMessage_insert(data: { conversationId: $conversationId, kind: ASPECTS, position: 2, aspects: [STRATEGY] })
      conversation_update(id: $conversationId, data: { nextMessagePosition_update: { inc: 1 }, messageCount_update: { inc: 1 } })
    }`,
    { conversationId: started.conversationId },
  )

  check(
    'a run whose note something follows is not resumed',
    (await refusal(resume())) !== null && (await refusal(resume({ nextMessagePosition: 3 }))) !== null,
  )

  await write(
    `mutation RemoveAspects($conversationId: UUID!) {
      conversationMessage_deleteMany(where: { conversationId: { eq: $conversationId }, kind: { eq: ASPECTS } })
      conversation_update(id: $conversationId, data: { nextMessagePosition_update: { dec: 1 }, messageCount_update: { dec: 1 } })
    }`,
    { conversationId: started.conversationId },
  )

  const { data: control } = await getConversationRunControlContext(dataConnect, {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
  })

  check(
    'a resume reads the latest runs, and the note and the message before it',
    control.latestRuns[0]?.id === started.runId
      && control.latestMessages[0]?.id === noteId
      && control.latestMessages[1]?.id === started.messageId
      && control.newestMessages[0]?.id === noteId,
  )

  await resume()

  const conversation = await readConversation(started.conversationId)

  check(
    'a resume deletes the note and starts a run on the anchor',
    (await readMessageAt(started.conversationId, 1)) === null
      && conversation?.activeRunId === runId
      && conversation.messageCount === 1
      && conversation.previewMessageId === started.messageId
      && (
        await read<{ conversationRun: { trigger: string; status: string; anchorPosition: number } | null }>(
          `query ReadResumed($id: UUID!) { conversationRun(id: $id) { trigger status anchorPosition } }`,
          { id: runId },
        )
      ).conversationRun?.trigger === 'RESUME',
  )
  check('a run is resumed once', (await refusal(resume({ runId: createId(), runNumber: 2 }))) !== null)

  const resumed = { ...started, runId }

  await claimQueuedConversationRun(dataConnect, fence(resumed, 0))
  await drawConversationAgentText(dataConnect, {
    ...fence(resumed, 1),
    entryId,
    fromBlock: 0,
    toBlock: 1,
    messageId: createId(),
    position: 2,
    text: 'Stored, never drawn',
    preview: { kind: 'AGENT_TEXT', text: 'Stored, never drawn' },
  })

  check(
    'a resumed run draws what the run it resumes stored',
    (await readMessageAt(started.conversationId, 2))?.kind === 'AGENT_TEXT',
  )

  await finishConversationRun(dataConnect, { ...fence(resumed, 1), status: ConversationRunStatus.COMPLETED })
}

/*
  Retrying a run that ended with a note: back to its anchor, the messages its runs drew deleted but
  the member's and an aspects note, the transcript cut, the history moved on, and a run on the anchor
*/
async function checkRetrying() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.retrier)
  const started = await start(userIds.retrier, membershipCreatedAt)
  const entryId = createId()

  await claimQueuedConversationRun(dataConnect, fence(started, 0))
  await storeConversationTurnWithContext(dataConnect, {
    ...fence(started, 1),
    contextEntryId: createId(),
    contextPosition: 1,
    contextContent: JSON.stringify([{ type: 'text', text: 'Context' }]),
    contextHash: 'hash',
    entryId,
    position: 2,
    content: JSON.stringify([{ type: 'text', text: 'Half a reply' }]),
  })
  await drawConversationAgentText(dataConnect, {
    ...fence(started, 1),
    entryId,
    fromBlock: 0,
    toBlock: 1,
    messageId: createId(),
    position: 1,
    text: 'Half a reply',
    preview: { kind: 'AGENT_TEXT', text: 'Half a reply' },
  })
  await write(
    `mutation AddAspects($conversationId: UUID!) {
      conversationMessage_insert(data: { conversationId: $conversationId, kind: ASPECTS, position: 2, aspects: [STRATEGY] })
      conversation_update(id: $conversationId, data: { nextMessagePosition_update: { inc: 1 }, messageCount_update: { inc: 1 }, isFull: true })
    }`,
    { conversationId: started.conversationId },
  )
  await finishConversationRunWithNote(dataConnect, {
    ...fence(started, 1),
    status: ConversationRunStatus.FAILED,
    noteKind: ConversationNoteKind.FAILED,
    noteId: createId(),
    position: 3,
    preview: { kind: 'NOTE', noteKind: 'FAILED' },
    failure: 'Checked',
  })

  const key = { organizationId, userId: started.userId, conversationId: started.conversationId }
  const { data: context } = await getConversationRetryContext(dataConnect, { ...key, anchorPosition: 0 })

  check(
    'a retry reads the runs on the anchor, what they drew and by which run, and the newest message it keeps',
    context.anchorRuns.length === 1
      && context.anchorRuns[0]?.id === started.runId
      && context.drawnMessages[0]?._count === 2
      && context.drawnRuns.length === 2
      && context.drawnRuns.every(({ run }) => run?.id === started.runId)
      && context.keptMessages[0]?.id === started.messageId,
  )

  const { data: ledgers } = await getConversationRunLedgers(dataConnect, { ...key, runIds: [started.runId] })
  const { data: unseenLedgers } = await getConversationRunLedgers(dataConnect, {
    ...key,
    userId: userIds.member,
    runIds: [started.runId],
  })

  check(
    'a run’s ledger is read by its id, and by nobody else',
    ledgers.conversationRuns[0]?.id === started.runId && unseenLedgers.conversationRuns.length === 0,
  )

  const runId = createId()
  const retry = (overrides: Variables = {}) =>
    retryConversationRun(dataConnect, {
      ...key,
      membershipCreatedAt,
      retriedRunId: started.runId,
      retriedRunNumber: 0,
      anchorPosition: 0,
      historyRevision: 0,
      deletedCount: 2,
      preview: { kind: 'MEMBER_TEXT', text: 'Checked message' },
      previewMessageId: started.messageId,
      runId,
      runNumber: 1,
      ...overrides,
    })

  check(
    'a retry that counted other messages, or read another history, deletes nothing',
    (await refusal(retry({ deletedCount: 1 }))) !== null
      && (await refusal(retry({ historyRevision: 1 }))) !== null
      && (await readMessageAt(started.conversationId, 1))?.kind === 'AGENT_TEXT',
  )

  await retry()

  const conversation = await read<{
    conversation: {
      activeRunId: string | null
      messageCount: number
      historyRevision: number
      unreadCount: number
      isFull: boolean
      previewMessageId: string | null
    } | null
  }>(
    `query ReadRetried($id: UUID!) {
      conversation(id: $id) { activeRunId messageCount historyRevision unreadCount isFull previewMessageId }
    }`,
    { id: started.conversationId },
  )
  const { data: transcript } = await getConversationTranscript(dataConnect, { ...key, afterPosition: -1 })

  check(
    'a retry deletes what the runs drew, but the member’s message and an aspects note',
    (await readMessageAt(started.conversationId, 0))?.kind === 'MEMBER_TEXT'
      && (await readMessageAt(started.conversationId, 1)) === null
      && (await readMessageAt(started.conversationId, 2))?.kind === 'ASPECTS'
      && (await readMessageAt(started.conversationId, 3)) === null,
  )
  check(
    'a retry cuts the transcript back to the anchor',
    transcript.conversationTranscriptEntries.map(({ position }) => position).join() === '0',
  )
  check(
    'a retry moves the history on, reads nothing unread, frees a full conversation and takes the new run',
    conversation.conversation?.activeRunId === runId
      && conversation.conversation.messageCount === 2
      && conversation.conversation.historyRevision === 1
      && conversation.conversation.unreadCount === 0
      && conversation.conversation.isFull === false
      && conversation.conversation.previewMessageId === started.messageId,
  )
  check('a run is retried once', (await refusal(retry({ runId: createId(), runNumber: 2, deletedCount: 0 }))) !== null)

  const retried = { ...started, runId }

  await claimQueuedConversationRun(dataConnect, fence(retried, 0))
  await finishConversationRun(dataConnect, { ...fence(retried, 1), status: ConversationRunStatus.COMPLETED })
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
    'a queued run’s lease past is pushed a queued lease out again, for its author alone',
    strangerRenewal.conversationRun_updateMany === 0
      && renewed.conversationRun_updateMany === 1
      && (await readLease()) > Date.now() + CONVERSATION_RUN_QUEUED_LEASE_MS - 60 * 1000,
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
    'starting leaves what was deleted over a day ago to the sweep, which deletes what it keeps beside its rows',
    (await readConversation(old)) !== null && (await readConversation(recent)) !== null,
  )

  const restore = (id: string) =>
    refusal(
      webConnector.executeMutation(
        'RestoreConversation',
        { organizationId, userId: userIds.pruner, id },
        { impersonate: { authClaims: { sub: userIds.pruner } } },
      ),
    )

  check(
    'a conversation deleted over a day ago cannot be restored, before any sweep has claimed it',
    ((await restore(old))?.includes('gone for good') ?? false) && (await readConversation(old))?.deletedAt != null,
  )
  check(
    'a conversation deleted within the day is restored',
    (await restore(recent)) === null && (await readConversation(recent))?.deletedAt === null,
  )
}

// The daily sweep: a claim that a restore then refuses, and a delete of what is claimed alone, with
// what cascades from it
async function checkSweeping() {
  const insertDeleted = async (days: number, hours: number) => {
    const id = createId()

    await write(
      `mutation InsertDeleted($id: UUID!, $userId: String!, $organizationId: UUID!, $days: Int!, $hours: Int!) {
        conversation_insert(data: { id: $id, userId: $userId, organizationId: $organizationId, title: "Deleted", deletedAt_time: { now: true, sub: { days: $days, hours: $hours } } })
      }`,
      { id, userId: userIds.sweeper, organizationId, days, hours },
    )

    return id
  }
  const readSwept = async (id: string) => {
    const data = await read<{
      conversation: { deletedAt: string | null; pruneClaimedAt: string | null } | null
      conversationRuns: { id: string }[]
      conversationMessages: { id: string }[]
      conversationTranscriptEntries: { id: string }[]
    }>(
      `query ReadSwept($id: UUID!) {
        conversation(id: $id) { deletedAt pruneClaimedAt }
        conversationRuns(where: { conversationId: { eq: $id } }) { id }
        conversationMessages(where: { conversationId: { eq: $id } }) { id }
        conversationTranscriptEntries(where: { conversationId: { eq: $id } }) { id }
      }`,
      { id },
    )

    return {
      ...data,
      rowCount:
        data.conversationRuns.length + data.conversationMessages.length + data.conversationTranscriptEntries.length,
    }
  }
  const restore = (id: string) =>
    refusal(
      webConnector.executeMutation(
        'RestoreConversation',
        { organizationId, userId: userIds.sweeper, id },
        { impersonate: { authClaims: { sub: userIds.sweeper } } },
      ),
    )

  const old = await insertDeleted(2, 0)
  const recent = await insertDeleted(0, 1)
  const restoredFirst = await insertDeleted(0, 23)

  // What cascades from a conversation: a run, its message and its transcript entry
  await write(
    `mutation InsertRows($conversationId: UUID!, $runId: UUID!) {
      conversationRun_insert(data: { id: $runId, conversationId: $conversationId, number: 0, trigger: MESSAGE, status: COMPLETED, membershipCreatedAt_expr: "request.time", anchorPosition: 0 })
      conversationMessage_insert(data: { conversationId: $conversationId, runId: $runId, kind: MEMBER_TEXT, text: "Swept", position: 0 })
      conversationTranscriptEntry_insert(data: { conversationId: $conversationId, runId: $runId, position: 0, role: USER, content: "[]" })
    }`,
    { conversationId: old, runId: createId() },
  )

  check('a restore before the sweep brings a conversation back', (await restore(restoredFirst)) === null)

  const { data: claim } = await claimDeletedConversations(dataConnect)

  check(
    'the sweep claims what was deleted over a day ago, and leaves what can still be taken back',
    claim.conversation_updateMany >= 1
      && (await readSwept(old)).conversation?.pruneClaimedAt != null
      && (await readSwept(recent)).conversation?.pruneClaimedAt === null
      && (await readSwept(restoredFirst)).conversation?.pruneClaimedAt === null,
  )
  check(
    'a conversation the sweep claimed cannot be restored',
    (await restore(old)) !== null && (await readSwept(old)).conversation?.deletedAt != null,
  )

  // Twenty at most, in no order, so `old` is among them unless the emulator holds twenty others
  const { data: claimed } = await getClaimedConversations(dataConnect)
  const claimedIds = claimed.conversations.map(({ id }) => id)

  check(
    'the claimed conversations read are claimed ones alone, twenty at most',
    claimedIds.length <= 20
      && (claimedIds.length === 20 || claimedIds.includes(old))
      && !claimedIds.includes(recent)
      && !claimedIds.includes(restoredFirst),
  )

  // What the agent's module calls stored under a conversation's scope, which goes before it
  const insertResult = (scope: string) =>
    write(
      `mutation InsertResult($scope: String!, $userId: String!, $organizationId: UUID!) {
        moduleCallResult_insert(data: { idempotencyScope: $scope, idempotencyKey: "toolu_swept", userId: $userId, organizationId: $organizationId, tool: "create_document", argumentsHash: "hash", result: "{}" })
      }`,
      { scope, userId: userIds.sweeper, organizationId },
    )
  const countResults = async (scope: string) =>
    (
      await read<{ moduleCallResults: unknown[] }>(
        `query CountResults($scope: String!) { moduleCallResults(where: { idempotencyScope: { eq: $scope } }) { tool } }`,
        { scope },
      )
    ).moduleCallResults.length

  await insertResult(`conversation:${old}`)
  await insertResult(`conversation:${recent}`)

  const { data: results } = await deleteConversationModuleCallResults(dataConnect, { scopes: [`conversation:${old}`] })

  check(
    "the sweep deletes the module call results of the conversations it names, by their scope, and nobody else's",
    results.moduleCallResult_deleteMany === 1
      && (await countResults(`conversation:${old}`)) === 0
      && (await countResults(`conversation:${recent}`)) === 1,
  )

  const { data: deletion } = await deleteClaimedConversations(dataConnect, { ids: [old, recent, restoredFirst] })
  const swept = await readSwept(old)

  check(
    'the sweep deletes a claimed conversation with its run, message and transcript, and nothing unclaimed',
    deletion.conversation_deleteMany === 1
      && swept.conversation === null
      && swept.rowCount === 0
      && (await readSwept(recent)).conversation !== null
      && (await readSwept(restoredFirst)).conversation !== null,
  )
}

/*
  What a run's request to Claude is built from and what its reply draws: the context stored with
  the first part, the transcript read in order, a web search's call, a text drawn in pieces with
  its citations, the usage the run's writes carry, and a conversation marked full
*/
async function checkReplies() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.drawer)
  const started = await start(userIds.drawer, membershipCreatedAt)
  const reference = {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
    runId: started.runId,
  }
  const readRunLedger = async () => {
    const data = await read<{ conversationRun: { context: string | null; usage: unknown } | null }>(
      `query ReadRunLedger($id: UUID!) { conversationRun(id: $id) { context usage } }`,
      { id: started.runId },
    )

    return data.conversationRun
  }
  const readEntries = async () => {
    const data = await read<{
      conversationTranscriptEntries: {
        position: number
        role: string
        contextHash: string | null
        drawnBlocks: number
        drawnPieces: number
      }[]
    }>(
      `query ReadEntries($id: UUID!) {
        conversationTranscriptEntries(where: { conversationId: { eq: $id } }, orderBy: [{ position: ASC }]) { position role contextHash drawnBlocks drawnPieces }
      }`,
      { id: started.conversationId },
    )

    return data.conversationTranscriptEntries
  }
  const readDrawn = async (id: string) => {
    const data = await read<{
      conversationMessage: {
        kind: string
        text: string | null
        citations: unknown
        toolName: string | null
        toolStatus: string | null
        toolOutput: string | null
      } | null
    }>(
      `query ReadDrawn($id: UUID!) { conversationMessage(id: $id) { kind text citations toolName toolStatus toolOutput } }`,
      { id },
    )

    return data.conversationMessage
  }

  await claimQueuedConversationRun(dataConnect, fence(started, 0))

  const fenced = fence(started, 1)
  const context = JSON.stringify({ hash: 'profile-hash', content: [{ type: 'text', text: 'Context' }] })
  const reserved = { requests: [{ model: 'claude-opus-5-5', isSettled: false }] }

  await renewConversationRunLease(dataConnect, { ...fenced, context, usage: reserved })
  await renewConversationRunLease(dataConnect, fenced)

  const ledger = await readRunLedger()

  check(
    'a renewal writes the run’s context and usage, and one without them keeps them',
    ledger?.context === context && isSameJson(ledger.usage, reserved),
  )

  const entryId = createId()
  const turn = JSON.stringify([
    { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'pricing' } },
    { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] },
    { type: 'text', text: 'First' },
    { type: 'text', text: 'Second', citations: null },
  ])
  const withContext = {
    ...fenced,
    contextEntryId: createId(),
    contextPosition: 1,
    contextContent: JSON.stringify([{ type: 'text', text: 'Context' }]),
    contextHash: 'profile-hash',
    entryId,
    position: 2,
    content: turn,
  }

  check(
    'a reply is stored right after its context or not at all',
    (await refusal(storeConversationTurnWithContext(dataConnect, { ...withContext, position: 3 }))) !== null
      && (await readEntries()).length === 1,
  )

  const settled = { requests: [{ model: 'claude-opus-5-5', isSettled: true, outputTokens: 12 }] }

  await storeConversationTurnWithContext(dataConnect, { ...withContext, usage: settled })

  const stored = await readEntries()

  check(
    'the context is stored with its hash just before the run’s first part, which settles the usage',
    stored.map(({ role }) => role).join() === 'USER,SYSTEM,ASSISTANT'
      && stored[1]?.contextHash === 'profile-hash'
      && isSameJson((await readRunLedger())?.usage, settled),
  )

  const conversationKey = { organizationId, userId: started.userId, conversationId: started.conversationId }
  const { data: page } = await getConversationTranscript(dataConnect, { ...conversationKey, afterPosition: 0 })
  const { data: strangers } = await getConversationTranscript(dataConnect, {
    ...conversationKey,
    userId: userIds.member,
    afterPosition: -1,
  })

  check(
    'the transcript is read after a position, in order, by its author alone',
    page.conversationTranscriptEntries.map(({ position }) => position).join() === '1,2'
      && page.conversationTranscriptEntries[0]?.contextHash === 'profile-hash'
      && strangers.conversationTranscriptEntries.length === 0,
  )

  const { data: runContext } = await getConversationRunContext(dataConnect, reference)

  check(
    'a run’s context reads its replies with their cursors, its context and its usage',
    runContext.runEntries.length === 1
      && runContext.runEntries[0]?.drawnPieces === 0
      && runContext.conversationRuns[0]?.context === context,
  )

  const callId = createId()
  const call = {
    ...fenced,
    entryId,
    fromBlock: 0,
    toBlock: 2,
    messageId: callId,
    position: 1,
    toolUseId: 'srvtoolu_1',
    toolName: 'web_search',
    toolStatus: ConversationToolStatus.SUCCEEDED,
    toolInput: '{"query":"pricing"}',
    toolOutput: '{"results":[]}',
    preview: { kind: 'TOOL_CALL', toolName: 'web_search', toolStatus: 'SUCCEEDED' },
  }

  check(
    'a server tool call is drawn finished or not at all',
    (await refusal(drawConversationToolCall(dataConnect, { ...call, toolStatus: ConversationToolStatus.RUNNING })))
      !== null,
  )

  await drawConversationToolCall(dataConnect, call)

  const drawnCall = await readDrawn(callId)

  check(
    'a web search is drawn as a finished call past its blocks, unread left alone',
    drawnCall?.kind === 'TOOL_CALL'
      && drawnCall.toolStatus === 'SUCCEEDED'
      && drawnCall.toolOutput === '{"results":[]}'
      && (await readEntries())[2]?.drawnBlocks === 2
      && (await readConversation(started.conversationId))?.unreadCount === 0,
  )

  const citations = [{ start: 0, end: 5, sources: [{ url: 'https://example.com', title: 'Example', citedText: 'x' }] }]
  const first = {
    ...fenced,
    entryId,
    fromBlock: 2,
    toBlock: 2,
    toPiece: 1,
    messageId: createId(),
    position: 2,
    text: 'First',
    citations,
    preview: { kind: 'AGENT_TEXT', text: 'First' },
  }

  check(
    'a first piece never moves the cursor back',
    (await refusal(drawConversationAgentText(dataConnect, { ...first, toBlock: 1 }))) !== null,
  )

  await drawConversationAgentText(dataConnect, first)

  check(
    'a first piece moves the cursor to the next piece, keeps its citations and adds the unread',
    (await readEntries())[2]?.drawnPieces === 1
      && isSameJson((await readDrawn(first.messageId))?.citations, citations)
      && (await readConversation(started.conversationId))?.unreadCount === 1,
  )
  check(
    'a whole text is not drawn while a text is part drawn',
    (await refusal(
      drawConversationAgentText(dataConnect, { ...first, toPiece: undefined, toBlock: 4, messageId: createId() }),
    )) !== null,
  )

  const piece = {
    ...fenced,
    entryId,
    block: 2,
    fromPiece: 1,
    toBlock: 2,
    toPiece: 2,
    messageId: createId(),
    position: 3,
    text: 'Fir',
    preview: { kind: 'AGENT_TEXT', text: 'Fir' },
  }

  await drawConversationAgentTextPiece(dataConnect, piece)

  check(
    'a later piece is drawn once, and adds no unread',
    (await refusal(drawConversationAgentTextPiece(dataConnect, { ...piece, messageId: createId(), position: 4 })))
      !== null && (await readConversation(started.conversationId))?.unreadCount === 1,
  )

  await drawConversationAgentTextPiece(dataConnect, {
    ...piece,
    fromPiece: 2,
    toBlock: 4,
    toPiece: 0,
    messageId: createId(),
    position: 4,
    text: 'st',
    preview: { kind: 'AGENT_TEXT', text: 'st' },
  })

  const drawnEntry = (await readEntries())[2]

  check(
    'the last piece moves the cursor past the text and back to piece 0',
    drawnEntry?.drawnBlocks === 4 && drawnEntry.drawnPieces === 0,
  )

  const { data: requestContext } = await getConversationRequestContext(dataConnect, conversationKey)

  check(
    'a request’s context reads the member, the organization, the conversation and its runs’ usage',
    requestContext.organization?.name === 'Checked organization'
      && requestContext.userOrganization?.role !== undefined
      && requestContext.conversations.length === 1
      && requestContext.conversationRuns[0]?.id === started.runId,
  )

  check(
    'a run cannot end with another status’s note',
    (await refusal(
      finishConversationRunWithNote(dataConnect, {
        ...fenced,
        status: ConversationRunStatus.STOPPED,
        noteKind: ConversationNoteKind.FULL,
        noteId: createId(),
        position: 5,
        preview: { kind: 'NOTE', noteKind: 'FULL' },
        failure: 'Mismatched',
      }),
    )) !== null,
  )

  await finishConversationRunWithNote(dataConnect, {
    ...fenced,
    status: ConversationRunStatus.FAILED,
    noteKind: ConversationNoteKind.FULL,
    noteId: createId(),
    position: 5,
    preview: { kind: 'NOTE', noteKind: 'FULL' },
    isFull: true,
    usage: settled,
    failure: 'Its next request would take 900000 input tokens',
  })

  const ended = await read<{
    conversation: { isFull: boolean } | null
    conversationRun: { failure: string | null } | null
  }>(
    `query ReadFull($id: UUID!, $runId: UUID!) { conversation(id: $id) { isFull } conversationRun(id: $runId) { failure } }`,
    { id: started.conversationId, runId: started.runId },
  )

  check('a run ending full marks its conversation full', ended.conversation?.isFull === true)
  check(
    'a run ending with a note says why',
    ended.conversationRun?.failure === 'Its next request would take 900000 input tokens',
  )

  const finished = await start(userIds.drawer, membershipCreatedAt)

  await claimQueuedConversationRun(dataConnect, fence(finished, 0))
  await finishConversationRun(dataConnect, {
    ...fence(finished, 1),
    status: ConversationRunStatus.COMPLETED,
    usage: settled,
  })

  const finishedLedger = await read<{ conversationRun: { usage: unknown } | null }>(
    `query ReadFinished($id: UUID!) { conversationRun(id: $id) { usage } }`,
    { id: finished.runId },
  )

  check('a run finishing settles its usage', isSameJson(finishedLedger.conversationRun?.usage, settled))
}

/*
  Questions and the calls of a turn: drawing a question within its bounds and a call to run,
  starting and finishing a call with the results the run keeps, ending a run waiting on its
  questions, answers counted under the conversation's lock, so two last answers at once never both
  see the other waiting, and an answer's continuation raced against a send, exactly one consuming
  the waiting turn
*/
async function checkQuestions() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.asker)

  // A run that asked two questions and called a tool beside them, all drawn, its call run, waiting
  async function startWaiting() {
    const started = await start(userIds.asker, membershipCreatedAt)
    const entryId = createId()
    const questions = [createId(), createId()]
    const callId = createId()

    await claimQueuedConversationRun(dataConnect, fence(started, 0))
    await storeConversationTurnWithContext(dataConnect, {
      ...fence(started, 1),
      contextEntryId: createId(),
      contextPosition: 1,
      contextContent: JSON.stringify([{ type: 'text', text: 'Context' }]),
      contextHash: 'hash',
      entryId,
      position: 2,
      content: JSON.stringify([
        { type: 'tool_use', id: `toolu_${questions[0]}`, name: 'ask_user', input: {} },
        { type: 'tool_use', id: `toolu_${questions[1]}`, name: 'ask_user', input: {} },
        { type: 'tool_use', id: `toolu_${callId}`, name: 'read_log', input: {} },
      ]),
    })

    const question = (index: number, overrides: Variables = {}) =>
      drawConversationQuestion(dataConnect, {
        ...fence(started, 1),
        entryId,
        fromBlock: index,
        toBlock: index + 1,
        messageId: questions[index] ?? '',
        position: index + 1,
        toolUseId: `toolu_${questions[index]}`,
        questionPrompt: `Question ${index}`,
        questionOptions: ['A', 'B'],
        isMultipleChoice: true,
        preview: { kind: 'QUESTION', questionState: 'WAITING', text: `Question ${index}` },
        ...overrides,
      })

    return { started, entryId, questions, callId, question }
  }

  const waiting = await startWaiting()
  const { started, entryId, questions, callId, question } = waiting

  check(
    'a question past its bounds is never drawn',
    (await refusal(question(0, { questionPrompt: 'a'.repeat(1001) }))) !== null
      && (await refusal(question(0, { questionOptions: ['A'] }))) !== null
      && (await refusal(question(0, { questionOptions: ['A', 'b'.repeat(201)] }))) !== null,
  )
  check(
    'a question at its bounds is drawn, unread',
    (await refusal(question(0, { questionPrompt: 'a'.repeat(1000), questionOptions: ['A', 'b'.repeat(200)] }))) === null
      && (await readConversation(started.conversationId))?.unreadCount === 1,
  )
  check('a question is drawn once', (await refusal(question(0))) !== null)

  await question(1)

  const call = (overrides: Variables = {}) =>
    drawConversationClientToolCall(dataConnect, {
      ...fence(started, 1),
      entryId,
      fromBlock: 2,
      toBlock: 3,
      messageId: callId,
      position: 3,
      toolUseId: `toolu_${callId}`,
      toolName: 'read_log',
      toolInput: '{}',
      preview: { kind: 'TOOL_CALL', toolName: 'read_log', toolStatus: 'RUNNING' },
      ...overrides,
    })

  check('a call to run is drawn running', (await refusal(call())) === null)

  const startCall = () => startConversationToolCall(dataConnect, { ...fence(started, 1), messageId: callId })
  const finishCall = (overrides: Variables = {}) =>
    finishConversationToolCall(dataConnect, {
      ...fence(started, 1),
      messageId: callId,
      toolStatus: ConversationToolStatus.SUCCEEDED,
      toolOutput: '{"entries":[]}',
      toolDurationMs: 12,
      pendingToolResults: JSON.stringify([{ type: 'tool_result', tool_use_id: `toolu_${callId}`, content: '[]' }]),
      preview: { kind: 'TOOL_CALL', toolName: 'read_log', toolStatus: 'SUCCEEDED' },
      ...overrides,
    })

  check(
    'a call starts, and starts again after a crash',
    (await refusal(startCall())) === null && (await refusal(startCall())) === null,
  )
  check('a call finishes only succeeded or failed', (await refusal(finishCall({ toolStatus: 'CANCELLED' }))) !== null)
  check('a call finishes, its result kept on the run', (await refusal(finishCall())) === null)
  check(
    'a call finishes once, and never starts again once it has',
    (await refusal(finishCall())) !== null && (await refusal(startCall())) !== null,
  )

  const { data: calls } = await getConversationCalls(dataConnect, {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
    toolUseIds: [`toolu_${callId}`],
  })

  check(
    'the run keeps the results of its turn’s calls',
    calls.latestRuns[0]?.pendingToolResults?.includes(`toolu_${callId}`) === true
      && calls.conversationMessages[0]?.toolStatus === ConversationToolStatus.SUCCEEDED,
  )

  await finishConversationRunWaiting(dataConnect, { ...fence(started, 1) })

  const waitingConversation = await read<{
    conversation: { isAwaitingAnswer: boolean; activeRunId: string | null } | null
  }>(`query ReadWaiting($id: UUID!) { conversation(id: $id) { isAwaitingAnswer activeRunId } }`, {
    id: started.conversationId,
  })

  check(
    'a run ending on questions waits, and its conversation waits for the answers',
    (await readRun(started.runId))?.status === ConversationRunStatus.WAITING
      && waitingConversation.conversation?.isAwaitingAnswer === true
      && waitingConversation.conversation.activeRunId === null,
  )

  const answer = (index: number, overrides: Variables = {}) =>
    answerConversationQuestion(dataConnect, {
      organizationId,
      userId: started.userId,
      conversationId: started.conversationId,
      runId: started.runId,
      messageId: questions[index] ?? '',
      previewMessageId: callId,
      answerSelected: ['A'],
      ...overrides,
    })

  check(
    'an answer is refused once the preview moved, or past its bounds',
    (await refusal(answer(0, { previewMessageId: createId() }))) !== null
      && (await refusal(answer(0, { answerSelected: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }))) !== null
      && (await refusal(answer(0, { answerSelected: [], answerOther: 'a'.repeat(501) }))) !== null
      && (await refusal(answer(0, { answerSelected: [] }))) !== null,
  )

  const continueRun = (runId: string) =>
    continueConversationRun(dataConnect, {
      organizationId,
      userId: started.userId,
      conversationId: started.conversationId,
      membershipCreatedAt,
      waitingRunId: started.runId,
      runId,
      runNumber: 1,
      content: JSON.stringify([{ type: 'tool_result', tool_use_id: 'x', content: '' }]),
      transcriptPosition: 3,
    })

  const { data: firstAnswer } = await answer(0)

  check('an answer counts the questions still waiting', firstAnswer.left?.conversationMessages.length === 1)
  check('a question is answered once', (await refusal(answer(0))) !== null)
  check('nothing carries on while a question waits', (await refusal(continueRun(createId()))) !== null)

  const { data: lastAnswer } = await answer(1, { answerSelected: [], answerOther: 'Own words' })

  check('the last answer finds none waiting', lastAnswer.left?.conversationMessages.length === 0)

  const send = (overrides: Variables = {}) =>
    sendConversationMessageAnsweringCalls(dataConnect, {
      organizationId,
      userId: started.userId,
      conversationId: started.conversationId,
      membershipCreatedAt,
      messageId: createId(),
      text: 'Instead',
      preview: { kind: 'MEMBER_TEXT', text: 'Instead' },
      position: 4,
      runId: createId(),
      runNumber: 1,
      content: JSON.stringify([{ type: 'text', text: 'Instead' }]),
      transcriptPosition: 3,
      lastRunId: started.runId,
      isLastRunWaiting: true,
      skippedQuestionIds: [],
      ...overrides,
    })

  check(
    'a send that reads the waiting run wrong, or skips a question answered, is refused',
    (await refusal(send({ isLastRunWaiting: false }))) !== null
      && (await refusal(send({ skippedQuestionIds: [questions[0]] }))) !== null,
  )

  const races = await Promise.all([refusal(continueRun(createId())), refusal(send())])

  check(
    'an answer’s continuation and a send at once consume the waiting turn once',
    races.filter(raced => raced === null).length === 1
      && (await readRun(started.runId))?.status === ConversationRunStatus.CONTINUED,
  )
  check('a consumed turn is consumed by nothing else', (await refusal(continueRun(createId()))) !== null)

  // Two last answers at once, each to its own question: the lock has the second see the first
  const second = await startWaiting()

  await second.question(0)
  await second.question(1)
  await finishConversationRunWaiting(dataConnect, { ...fence(second.started, 1) })

  const answerSecond = (index: number) =>
    answerConversationQuestion(dataConnect, {
      organizationId,
      userId: second.started.userId,
      conversationId: second.started.conversationId,
      runId: second.started.runId,
      messageId: second.questions[index] ?? '',
      previewMessageId: second.questions[1] ?? '',
      answerSelected: ['B'],
    })
  const lefts = await Promise.all([answerSecond(0), answerSecond(1)])

  check(
    'two last answers at once never both see the other waiting',
    lefts
      .map(({ data }) => data.left?.conversationMessages.length ?? -1)
      .sort()
      .join() === '0,1',
  )

  // A call drawn by one run is cancelled by the next run's end, which runs it after a resume
  await write(
    `mutation AddRunningCall($conversationId: UUID!, $runId: UUID!) {
      conversationMessage_insert(data: { conversationId: $conversationId, runId: $runId, kind: TOOL_CALL, toolName: "read_log", toolStatus: RUNNING, position: 999 })
    }`,
    { conversationId: started.conversationId, runId: started.runId },
  )

  const { data: turn } = await getConversationTurnContext(dataConnect, {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
  })
  const [continuing] = turn.latestRuns

  if (!continuing) throw new Error('No run carries the conversation on')

  const continued = { ...started, runId: continuing.id }

  await claimQueuedConversationRun(dataConnect, fence(continued, 0))
  await finishConversationRunWithNote(dataConnect, {
    ...fence(continued, 1),
    status: ConversationRunStatus.STOPPED,
    noteKind: ConversationNoteKind.STOPPED,
    noteId: createId(),
    position: (await readConversation(started.conversationId))?.nextMessagePosition ?? 0,
    preview: { kind: 'NOTE', noteKind: 'STOPPED' },
  })

  const toolStatus = await read<{ conversationMessages: { toolStatus: string | null }[] }>(
    `query ReadCall($conversationId: UUID!) {
      conversationMessages(where: { conversationId: { eq: $conversationId }, position: { eq: 999 } }) { toolStatus }
    }`,
    { conversationId: started.conversationId },
  )

  check(
    'a run’s end cancels the calls running in its conversation, whichever run drew them',
    toolStatus.conversationMessages[0]?.toolStatus === ConversationToolStatus.CANCELLED,
  )
}

/*
  A call to a module's write that a run left started and unfinished, recorded as what the module
  stored under its key once the run has let go of the conversation: never a call that finished or
  never started, nor while a run holds the conversation, nor anybody else's
*/
async function checkSettling() {
  const insertConversation = async (fields: string) => {
    const id = createId()

    await write(
      `mutation InsertConversation($id: UUID!, $userId: String!, $organizationId: UUID!) {
        conversation_insert(data: { id: $id, userId: $userId, organizationId: $organizationId, title: "Settled"${fields} })
      }`,
      { id, userId: userIds.settler, organizationId },
    )

    return id
  }
  const insertCall = async (conversationId: string, position: number, fields: string) => {
    const id = createId()

    await write(
      `mutation InsertCall($id: UUID!, $conversationId: UUID!, $position: Int!) {
        conversationMessage_insert(data: { id: $id, conversationId: $conversationId, kind: TOOL_CALL, position: $position, toolUseId: "toolu_settled", toolName: "create_document", toolInput: "{}"${fields} })
      }`,
      { id, conversationId, position },
    )

    return id
  }
  const readCall = async (id: string) =>
    (
      await read<{ conversationMessage: { toolStatus: string; toolOutput: string | null } | null }>(
        `query ReadCall($id: UUID!) { conversationMessage(id: $id) { toolStatus toolOutput } }`,
        { id },
      )
    ).conversationMessage
  const settle = (conversationId: string, messageId: string, userId = userIds.settler) =>
    settleConversationToolCall(dataConnect, {
      organizationId,
      userId,
      conversationId,
      messageId,
      toolOutput: '{"id":"settled"}',
    })

  const idle = await insertConversation('')
  const busy = await insertConversation(`, activeRunId: "${createId()}"`)
  const deleted = await insertConversation(', deletedAt_expr: "request.time"')
  const started = ', toolStartedAt_expr: "request.time"'
  const cancelled = await insertCall(idle, 0, `, toolStatus: CANCELLED${started}`)
  const running = await insertCall(idle, 1, `, toolStatus: RUNNING${started}`)
  const neverStarted = await insertCall(idle, 2, ', toolStatus: CANCELLED')
  const finished = await insertCall(idle, 3, `, toolStatus: FAILED, toolOutput: "{}"${started}`)
  const spare = await insertCall(idle, 4, `, toolStatus: CANCELLED${started}`)
  const whileBusy = await insertCall(busy, 0, `, toolStatus: RUNNING${started}`)
  const whileDeleted = await insertCall(deleted, 0, `, toolStatus: CANCELLED${started}`)

  const { data: settled } = await settle(idle, cancelled)

  check(
    'a started call a run left cancelled is settled with what the module stored',
    settled.conversationMessage_updateMany === 1
      && (await readCall(cancelled))?.toolStatus === ConversationToolStatus.SUCCEEDED
      && (await readCall(cancelled))?.toolOutput === '{"id":"settled"}',
  )
  check(
    'a started call left running is settled once its run let go of the conversation',
    (await settle(idle, running)).data.conversationMessage_updateMany === 1,
  )
  check(
    'a call settled again changes nothing',
    (await settle(idle, cancelled)).data.conversationMessage_updateMany === 0,
  )
  check(
    'a call that never started, or that finished, is not settled',
    (await settle(idle, neverStarted)).data.conversationMessage_updateMany === 0
      && (await settle(idle, finished)).data.conversationMessage_updateMany === 0
      && (await readCall(finished))?.toolStatus === ConversationToolStatus.FAILED,
  )
  check(
    'nothing is settled while a run holds the conversation, or once it is deleted',
    (await settle(busy, whileBusy)).data.conversationMessage_updateMany === 0
      && (await settle(deleted, whileDeleted)).data.conversationMessage_updateMany === 0
      && (await readCall(whileBusy))?.toolStatus === ConversationToolStatus.RUNNING,
  )
  check(
    "another member's call, and a call named under another conversation, are not settled",
    (await settle(idle, spare, userIds.author)).data.conversationMessage_updateMany === 0
      && (await settle(busy, spare)).data.conversationMessage_updateMany === 0
      && (await readCall(spare))?.toolStatus === ConversationToolStatus.CANCELLED,
  )
}

type TaggedConversation = {
  aspects: string[]
  aspectsSetBy: string | null
  nextMessagePosition: number
  messageCount: number
  unreadCount: number
  previewMessageId: string | null
}

type StoredCall = {
  id: string
  kind: string
  toolStatus: string | null
  toolStartedAt: string | null
  integrationId: string | null
  integrationName: string | null
  approvalState: string | null
  approvalToolHash: string | null
  argumentsPreview: string | null
  isToolUnanswered: boolean | null
}

async function readCall(id: string) {
  const data = await read<{ conversationMessage: StoredCall | null }>(
    `query ReadCall($id: UUID!) {
      conversationMessage(id: $id) {
        id kind toolStatus toolStartedAt integrationId integrationName approvalState approvalToolHash argumentsPreview
        isToolUnanswered
      }
    }`,
    { id },
  )

  return data.conversationMessage
}

/*
  Calls to an integration's tools: one that runs without approval drawn running with what that is
  bound to, one that waits drawn as an approval, unread, and one refused drawn failed with its
  server; a call started once only, never one waiting, and marking its server used; an approval
  finished denied, an allowed one cancelled when its run ends; a run anchored on the results it
  stores; and a server pruned leaving its calls in the thread
*/
async function checkIntegrationCalls() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.integrator)
  const integrationId = createId()

  await write(
    `mutation InsertIntegration($id: UUID!, $organizationId: UUID!) {
      organizationIntegration_insert(data: {
        id: $id, organizationId: $organizationId, name: "Issues", normalizedName: "issues",
        url: "https://mcp.example.com/mcp", authentication: NONE
      })
    }`,
    { id: integrationId, organizationId },
  )

  const started = await start(userIds.integrator, membershipCreatedAt)
  const entryId = createId()
  const [autoId, approvalId, refusedId] = [createId(), createId(), createId()]
  const callInput = (tool: string) => JSON.stringify({ integration: integrationId, tool, arguments: { query: 'open' } })

  await claimQueuedConversationRun(dataConnect, fence(started, 0))
  await storeConversationTurnWithContext(dataConnect, {
    ...fence(started, 1),
    contextEntryId: createId(),
    contextPosition: 1,
    contextContent: JSON.stringify([{ type: 'text', text: 'Context' }]),
    contextHash: 'hash',
    entryId,
    position: 2,
    content: JSON.stringify(
      [autoId, approvalId, refusedId].map(id => ({
        type: 'tool_use',
        id: `toolu_${id}`,
        name: 'call_integration_tool',
        input: {},
      })),
    ),
  })

  const integration = { integrationId, integrationName: 'Issues', integrationToolName: 'list_issues' }
  const binding = { approvalConfigRevision: 0, approvalToolHash: 'a'.repeat(64), approvalCredentialGeneration: null }

  check(
    'a call that runs without approval is drawn running, with its server and what it is bound to',
    (await refusal(
      drawConversationClientToolCall(dataConnect, {
        ...fence(started, 1),
        entryId,
        fromBlock: 0,
        toBlock: 1,
        messageId: autoId,
        position: 1,
        toolUseId: `toolu_${autoId}`,
        toolName: 'call_integration_tool',
        toolInput: callInput('list_issues'),
        preview: {
          kind: 'TOOL_CALL',
          toolName: 'call_integration_tool',
          toolStatus: 'RUNNING',
          integrationName: 'Issues',
        },
        ...integration,
        ...binding,
      }),
    )) === null
      && (await readCall(autoId))?.integrationId === integrationId
      && (await readCall(autoId))?.approvalToolHash === binding.approvalToolHash
      && (await readCall(autoId))?.approvalState === null,
  )

  const approval = (overrides: Variables = {}) =>
    drawConversationApproval(dataConnect, {
      ...fence(started, 1),
      entryId,
      fromBlock: 1,
      toBlock: 2,
      messageId: approvalId,
      position: 2,
      toolUseId: `toolu_${approvalId}`,
      toolName: 'call_integration_tool',
      toolInput: callInput('create_issue'),
      ...integration,
      integrationToolName: 'create_issue',
      ...binding,
      argumentsPreview: '{"query":"open"}',
      preview: {
        kind: 'APPROVAL',
        integrationName: 'Issues',
        integrationToolName: 'create_issue',
        approvalState: 'PENDING',
        toolStatus: null,
      },
      ...overrides,
    })
  const unreadBefore = (await readConversation(started.conversationId))?.unreadCount ?? 0

  check(
    "an approval's preview of its arguments is held to 2000 characters and its ellipsis",
    (await refusal(approval({ argumentsPreview: 'a'.repeat(2002) }))) !== null,
  )
  check(
    'a call that waits is drawn as an approval, pending, unread, and the preview',
    (await refusal(approval())) === null
      && (await readCall(approvalId))?.approvalState === 'PENDING'
      && (await readCall(approvalId))?.toolStatus === null
      && (await readConversation(started.conversationId))?.unreadCount === unreadBefore + 1
      && (await readConversation(started.conversationId))?.previewMessageId === approvalId,
  )

  check(
    'a call refused is drawn failed, with the server it named',
    (await refusal(
      drawConversationToolCall(dataConnect, {
        ...fence(started, 1),
        entryId,
        fromBlock: 2,
        toBlock: 3,
        messageId: refusedId,
        position: 3,
        toolUseId: `toolu_${refusedId}`,
        toolName: 'call_integration_tool',
        toolStatus: ConversationToolStatus.FAILED,
        toolInput: callInput('list_issues'),
        toolOutput: '{"error":"Issues is turned off."}',
        preview: {
          kind: 'TOOL_CALL',
          toolName: 'call_integration_tool',
          toolStatus: 'FAILED',
          integrationName: 'Issues',
        },
        ...integration,
      }),
    )) === null && (await readCall(refusedId))?.integrationName === 'Issues',
  )

  const { data: calls } = await getConversationCalls(dataConnect, {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
    toolUseIds: [autoId, approvalId, refusedId].map(id => `toolu_${id}`),
  })

  check(
    "a turn's calls are read with their approvals and what they are bound to",
    calls.conversationMessages.length === 3
      && calls.conversationMessages.some(
        message => message.kind === 'APPROVAL' && message.approvalToolHash === binding.approvalToolHash,
      ),
  )

  const startCall = (messageId: string) =>
    startConversationIntegrationCall(dataConnect, { ...fence(started, 1), messageId, integrationId })
  const readLastUsedAt = async () =>
    (
      await read<{ organizationIntegration: { lastUsedAt: string | null } | null }>(
        `query ReadLastUsed($id: UUID!) { organizationIntegration(id: $id) { lastUsedAt } }`,
        { id: integrationId },
      )
    ).organizationIntegration?.lastUsedAt ?? null
  const finishCall = (messageId: string, overrides: Variables = {}) =>
    finishConversationIntegrationCall(dataConnect, {
      ...fence(started, 1),
      messageId,
      toolStatus: ConversationToolStatus.SUCCEEDED,
      toolOutput: '{"content":[]}',
      toolDurationMs: 40,
      pendingToolResults: '[]',
      preview: { kind: 'TOOL_CALL', toolName: 'call_integration_tool', toolStatus: 'SUCCEEDED' },
      ...overrides,
    })

  check('a call waiting for its approval never starts', (await refusal(startCall(approvalId))) !== null)
  check(
    'a call that runs without approval starts, and marks its server used',
    (await refusal(startCall(autoId))) === null && (await readLastUsedAt()) !== null,
  )
  check('a call that started never starts again', (await refusal(startCall(autoId))) !== null)
  check(
    'a call finishes, and its approval, if any, only denied',
    (await refusal(finishCall(autoId, { approvalState: 'ALLOWED' }))) !== null
      && (await refusal(finishCall(autoId))) === null
      && (await readCall(autoId))?.toolStatus === ConversationToolStatus.SUCCEEDED,
  )

  // The member allows the approval, as answering it does, and the call starts
  await write(
    `mutation Allow($id: UUID!) { conversationMessage_update(id: $id, data: { approvalState: ALLOWED, answeredAt_expr: "request.time" }) }`,
    { id: approvalId },
  )

  check('an approval allowed starts', (await refusal(startCall(approvalId))) === null)

  const storeResults = (anchorPosition: number) =>
    storeConversationToolResults(dataConnect, {
      ...fence(started, 1),
      entryId: createId(),
      position: 3,
      content: '[]',
      anchorPosition,
    })

  check(
    'a run is anchored only on the results it stores',
    (await refusal(storeResults(2))) !== null
      && (await refusal(storeResults(3))) === null
      && (
        await read<{ conversationRun: { anchorPosition: number } | null }>(
          `query ReadAnchor($id: UUID!) { conversationRun(id: $id) { anchorPosition } }`,
          { id: started.runId },
        )
      ).conversationRun?.anchorPosition === 3,
  )

  await finishConversationRunWaiting(dataConnect, { ...fence(started, 1) })

  check(
    'an allowed call still running is cancelled when its run ends',
    (await readCall(approvalId))?.toolStatus === ConversationToolStatus.CANCELLED,
  )

  // Claimed again by the next worker, which finishes it as interrupted, denied
  await write(
    `mutation Requeue($id: UUID!) { conversationRun_update(id: $id, data: { status: RUNNING, attempts: 1 }) }`,
    { id: started.runId },
  )

  check(
    'a call left started is finished by the next worker, never started again',
    (await refusal(startCall(approvalId))) !== null
      && (await refusal(
        finishCall(approvalId, {
          toolStatus: ConversationToolStatus.FAILED,
          toolOutput: '{"error":"This call was interrupted and may have run."}',
          toolDurationMs: null,
          isToolUnanswered: true,
          approvalState: 'DENIED',
        }),
      )) === null
      && (await readCall(approvalId))?.approvalState === 'DENIED'
      && (await readCall(approvalId))?.isToolUnanswered === true,
  )
  check(
    'a call finished by a backend from before M36, saying nothing of its answer, records none',
    (await readCall(autoId))?.isToolUnanswered === null,
  )

  await write(`mutation Prune($id: UUID!) { organizationIntegration_delete(id: $id) }`, { id: integrationId })

  check(
    'a server pruned leaves its calls in the thread, with its name',
    (await readCall(autoId))?.integrationId === null && (await readCall(autoId))?.integrationName === 'Issues',
  )
}

/*
  Approvals: an Allow or a Deny recorded once, under the conversation's lock, beside a question it
  waits with; a continuation that answers the turn refused while a call the member allowed waits to
  run, and the one that carries it on closing the calls a stop kept from running; and a send that
  denies the approvals waiting, refused when it read them otherwise, or names none at all, in either
  order against the member's decision
*/
async function checkApprovals() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.approver)
  const integrationId = createId()

  await write(
    `mutation InsertIntegration($id: UUID!, $organizationId: UUID!) {
      organizationIntegration_insert(data: {
        id: $id, organizationId: $organizationId, name: "Issues", normalizedName: "issues",
        url: "https://mcp.example.com/mcp", authentication: NONE
      })
    }`,
    { id: integrationId, organizationId },
  )

  /*
    A run that proposed a call, asked a question beside it, and drew a call to run that a stop kept
    from starting, then waits. Each conversation is its own, and each run ends before the next starts,
    so the member never holds 3 in flight
  */
  async function startWaiting() {
    const started = await start(userIds.approver, membershipCreatedAt)
    const entryId = createId()
    const [approvalId, questionId, callId] = [createId(), createId(), createId()]

    await claimQueuedConversationRun(dataConnect, fence(started, 0))
    await storeConversationTurnWithContext(dataConnect, {
      ...fence(started, 1),
      contextEntryId: createId(),
      contextPosition: 1,
      contextContent: JSON.stringify([{ type: 'text', text: 'Context' }]),
      contextHash: 'hash',
      entryId,
      position: 2,
      content: JSON.stringify([
        { type: 'tool_use', id: `toolu_${approvalId}`, name: 'call_integration_tool', input: {} },
        { type: 'tool_use', id: `toolu_${questionId}`, name: 'ask_user', input: {} },
        { type: 'tool_use', id: `toolu_${callId}`, name: 'read_log', input: {} },
      ]),
    })
    await drawConversationApproval(dataConnect, {
      ...fence(started, 1),
      entryId,
      fromBlock: 0,
      toBlock: 1,
      messageId: approvalId,
      position: 1,
      toolUseId: `toolu_${approvalId}`,
      toolName: 'call_integration_tool',
      toolInput: '{}',
      integrationId,
      integrationName: 'Issues',
      integrationToolName: 'create_issue',
      approvalConfigRevision: 0,
      approvalToolHash: 'a'.repeat(64),
      approvalCredentialGeneration: null,
      argumentsPreview: '{}',
      preview: { kind: 'APPROVAL' },
    })
    await drawConversationQuestion(dataConnect, {
      ...fence(started, 1),
      entryId,
      fromBlock: 1,
      toBlock: 2,
      messageId: questionId,
      position: 2,
      toolUseId: `toolu_${questionId}`,
      questionPrompt: 'Which price?',
      questionOptions: ['A', 'B'],
      isMultipleChoice: false,
      preview: { kind: 'QUESTION' },
    })
    await drawConversationClientToolCall(dataConnect, {
      ...fence(started, 1),
      entryId,
      fromBlock: 2,
      toBlock: 3,
      messageId: callId,
      position: 3,
      toolUseId: `toolu_${callId}`,
      toolName: 'read_log',
      toolInput: '{}',
      preview: { kind: 'TOOL_CALL', toolName: 'read_log', toolStatus: 'RUNNING' },
    })
    await finishConversationRunWaiting(dataConnect, { ...fence(started, 1) })

    return { started, approvalId, questionId, callId }
  }

  // The preview the lock is matched on, read as the backend reads it
  const readPreviewMessageId = async (started: Started) =>
    (await readConversation(started.conversationId))?.previewMessageId ?? ''
  const decide = async (started: Started, approvalId: string, overrides: Variables = {}) =>
    answerConversationApproval(dataConnect, {
      organizationId,
      userId: started.userId,
      conversationId: started.conversationId,
      runId: started.runId,
      messageId: approvalId,
      previewMessageId: await readPreviewMessageId(started),
      approvalState: ConversationApprovalState.ALLOWED,
      ...overrides,
    })
  const answerQuestion = async (started: Started, questionId: string) =>
    answerConversationQuestion(dataConnect, {
      organizationId,
      userId: started.userId,
      conversationId: started.conversationId,
      runId: started.runId,
      messageId: questionId,
      previewMessageId: await readPreviewMessageId(started),
      answerSelected: ['A'],
    })
  const send = (started: Started, overrides: Variables = {}) =>
    sendConversationMessageAnsweringCalls(dataConnect, {
      organizationId,
      userId: started.userId,
      conversationId: started.conversationId,
      membershipCreatedAt,
      messageId: createId(),
      text: 'Instead',
      preview: { kind: 'MEMBER_TEXT', text: 'Instead' },
      position: 4,
      runId: createId(),
      runNumber: 1,
      content: JSON.stringify([{ type: 'text', text: 'Instead' }]),
      transcriptPosition: 3,
      lastRunId: started.runId,
      isLastRunWaiting: true,
      skippedQuestionIds: [],
      ...overrides,
    })

  // The call drawn to run is cancelled when the run waits, a stop having kept it from starting
  const first = await startWaiting()

  check(
    'a call a stop kept from running is cancelled as its run waits',
    (await readCall(first.callId))?.toolStatus === ConversationToolStatus.CANCELLED,
  )
  check(
    'an Allow carries no failure, and a Deny carries one',
    (await refusal(decide(first.started, first.approvalId, { toolStatus: 'FAILED', toolOutput: '{}' }))) !== null
      && (await refusal(decide(first.started, first.approvalId, { approvalState: 'DENIED' }))) !== null,
  )

  const allowed = await decide(first.started, first.approvalId)

  check(
    'an Allow is recorded, the question beside it still waiting',
    allowed.data.left?.conversationMessages.length === 1
      && (await readCall(first.approvalId))?.approvalState === 'ALLOWED',
  )
  check('an approval is decided once', (await refusal(decide(first.started, first.approvalId))) !== null)

  const answered = await answerQuestion(first.started, first.questionId)

  check(
    'the last answer reads nothing left, the approval decided included',
    answered.data.left?.conversationMessages.length === 0,
  )

  const continuation = {
    organizationId,
    userId: first.started.userId,
    conversationId: first.started.conversationId,
    membershipCreatedAt,
    waitingRunId: first.started.runId,
    runId: createId(),
    runNumber: 1,
  }

  check(
    'a continuation answering the turn is refused while a call the member allowed waits to run',
    await isRefused(
      continueConversationRun(dataConnect, { ...continuation, content: '[]', transcriptPosition: 3 }),
      'A call the member allowed waits to run',
    ),
  )

  const withCalls = (overrides: Variables = {}) =>
    continueConversationRunWithCalls(dataConnect, {
      ...continuation,
      anchorPosition: 0,
      pendingToolResults: '[]',
      stoppedCallIds: [first.callId],
      stoppedCallOutput: '{"error":"The member stopped the response before this ran."}',
      ...overrides,
    })

  check(
    'a continuation carrying allowed calls is refused when it names a call of the turn no stop kept from running',
    await isRefused(
      withCalls({ stoppedCallIds: [first.callId, first.approvalId] }),
      "The turn's calls changed since the continuation read them",
    ),
  )
  check(
    'a continuation carries the allowed calls on, with no entry, the calls a stop kept answered as stopped',
    (await refusal(withCalls())) === null
      && (await readCall(first.callId))?.toolStatus === ConversationToolStatus.FAILED
      && (await readRun(first.started.runId))?.status === 'CONTINUED'
      && (await readRun(continuation.runId))?.status === 'QUEUED',
  )

  await stopQueuedConversationRun(dataConnect, {
    organizationId,
    userId: first.started.userId,
    conversationId: first.started.conversationId,
    runId: continuation.runId,
    noteId: createId(),
    position: 4,
    preview: { kind: 'NOTE', noteKind: 'STOPPED' },
  })

  check(
    'an allowed call is left as it was when its queued run is stopped',
    (await readCall(first.approvalId))?.toolStatus === null,
  )

  // A send denies an approval waiting, and refuses one it read otherwise
  const second = await startWaiting()

  check(
    'a send that names no approval is refused while one waits, as an older backend sends',
    await isRefused(
      send(second.started, { skippedQuestionIds: [second.questionId] }),
      'The calls waiting for approval changed since the send read them',
    ),
  )
  check(
    'a send denies the approvals waiting, as the member did not approve them',
    (await refusal(
      send(second.started, {
        skippedQuestionIds: [second.questionId],
        deniedApprovalIds: [second.approvalId],
        deniedApprovalOutput: '{"error":"The member did not approve this call and wrote instead."}',
        closedApprovalIds: [],
      }),
    )) === null && (await readCall(second.approvalId))?.approvalState === 'DENIED',
  )
  check(
    'a decision after the send denied the approval is refused',
    (await refusal(decide(second.started, second.approvalId, { previewMessageId: createId() }))) !== null,
  )

  // A Deny first, then a send that read the approval as waiting
  const third = await startWaiting()

  await decide(third.started, third.approvalId, {
    approvalState: 'DENIED',
    toolStatus: 'FAILED',
    toolOutput: '{"error":"The member denied this call."}',
  })

  check(
    'a send that read an approval as waiting is refused once the member decided it',
    await isRefused(
      send(third.started, {
        skippedQuestionIds: [third.questionId],
        deniedApprovalIds: [third.approvalId],
        deniedApprovalOutput: '{}',
        closedApprovalIds: [],
      }),
      'The calls waiting for approval changed since the send read them',
    ),
  )

  // An Allow, then a send before any run made the call, which answers it as not run
  const fourth = await startWaiting()

  await decide(fourth.started, fourth.approvalId)

  check(
    'a send answers as not run a call allowed that never ran, refused when it names none, as an older backend sends',
    (await refusal(
      send(fourth.started, {
        skippedQuestionIds: [fourth.questionId],
        deniedApprovalIds: [],
      }),
    )) !== null
      && (await refusal(
        send(fourth.started, {
          skippedQuestionIds: [fourth.questionId],
          deniedApprovalIds: [],
          closedApprovalIds: [fourth.approvalId],
          closedApprovalOutput: '{"error":"The member wrote instead before this call ran."}',
        }),
      )) === null
      && (await readCall(fourth.approvalId))?.toolStatus === ConversationToolStatus.FAILED,
  )
}

async function readTags(conversationId: string, runId: string, position: number) {
  return read<{
    conversation: TaggedConversation | null
    conversationRun: { usage: unknown; leaseExpiresAt: string | null } | null
    conversationMessages: {
      id: string
      kind: string
      aspects: string[] | null
      aspectsSetBy: string | null
      run: { id: string } | null
    }[]
  }>(
    `query ReadTags($conversationId: UUID!, $runId: UUID!, $position: Int!) {
      conversation(id: $conversationId) { aspects aspectsSetBy nextMessagePosition messageCount unreadCount previewMessageId }
      conversationRun(id: $runId) { usage leaseExpiresAt }
      conversationMessages(where: { conversationId: { eq: $conversationId }, position: { eq: $position } }) {
        id kind aspects aspectsSetBy run { id }
      }
    }`,
    { conversationId, runId, position },
  )
}

// The draft's aspects that start a conversation, and the agent's tag, only while nobody set them
async function checkTagging() {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.tagger)
  const drafted = await start(
    userIds.tagger,
    membershipCreatedAt,
    {},
    { aspects: [CompanyAspect.SALES, CompanyAspect.FINANCES], aspectsSetBy: ConversationActor.MEMBER },
  )
  const draftedTags = await readTags(drafted.conversationId, drafted.runId, 0)

  check(
    "a conversation starts with the aspects its member picked on the draft, as the member's, and no note",
    draftedTags.conversation?.aspects.join() === 'SALES,FINANCES'
      && draftedTags.conversation.aspectsSetBy === 'MEMBER'
      && draftedTags.conversation.messageCount === 1
      && draftedTags.conversationMessages[0]?.kind === 'MEMBER_TEXT',
  )
  check(
    "a draft's aspects named twice, given without their member, or given as the agent's are refused",
    (await refusal(
      start(
        userIds.tagger,
        membershipCreatedAt,
        {},
        {
          aspects: [CompanyAspect.SALES, CompanyAspect.SALES],
          aspectsSetBy: ConversationActor.MEMBER,
        },
      ),
    )) !== null
      && (await refusal(start(userIds.tagger, membershipCreatedAt, {}, { aspects: [CompanyAspect.SALES] }))) !== null
      && (await refusal(
        start(
          userIds.tagger,
          membershipCreatedAt,
          {},
          { aspects: [CompanyAspect.SALES], aspectsSetBy: ConversationActor.AGENT },
        ),
      )) !== null
      && (await refusal(start(userIds.tagger, membershipCreatedAt, {}, { aspectsSetBy: ConversationActor.MEMBER })))
        !== null,
  )

  await complete(drafted)

  const untagged = await start(userIds.tagger, membershipCreatedAt)
  const untaggedTags = await readTags(untagged.conversationId, untagged.runId, 0)

  check(
    'a conversation started without aspects has none, set by nobody',
    untaggedTags.conversation?.aspects.length === 0 && untaggedTags.conversation.aspectsSetBy === null,
  )

  await claimQueuedConversationRun(dataConnect, fence(untagged, 0))

  const usage = {
    requests: [{ purpose: 'tagging', inputTokens: 300, outputTokens: 20, isSettled: true, inputEndPosition: 0 }],
    byModel: {},
  }
  const tag = (
    started: Started,
    attempts: number,
    position: number,
    aspects: CompanyAspect[] = [CompanyAspect.PRODUCT],
  ) =>
    tagConversationAspects(dataConnect, {
      ...fence(started, attempts),
      usage,
      aspects,
      noteId: createId(),
      position,
    })

  check(
    'a tag from a worker whose attempt is no longer the run’s is refused',
    (await refusal(tag(untagged, 0, 1))) !== null,
  )
  check(
    'a tag with no aspect, four, or one twice is refused',
    (await refusal(tag(untagged, 1, 1, []))) !== null
      && (await refusal(
        tag(untagged, 1, 1, [CompanyAspect.SALES, CompanyAspect.LEGAL, CompanyAspect.PRODUCT, CompanyAspect.DESIGN]),
      )) !== null
      && (await refusal(tag(untagged, 1, 1, [CompanyAspect.SALES, CompanyAspect.SALES]))) !== null,
  )
  check('a tag at a position another write took first is refused', (await refusal(tag(untagged, 1, 2))) !== null)

  const tagFailure = await refusal(tag(untagged, 1, 1, [CompanyAspect.PRODUCT, CompanyAspect.STRATEGY]))
  const tagged = await readTags(untagged.conversationId, untagged.runId, 1)
  const [note] = tagged.conversationMessages

  check(
    "a tag at the counter sets the aspects as the agent's, with their note at that position, which belongs to no run",
    tagFailure === null
      && tagged.conversation?.aspects.join() === 'PRODUCT,STRATEGY'
      && tagged.conversation.aspectsSetBy === 'AGENT'
      && note?.kind === 'ASPECTS'
      && note.aspects?.join() === 'PRODUCT,STRATEGY'
      && note.aspectsSetBy === 'AGENT'
      && note.run === null,
  )
  check(
    'the tag moves the counter and the count on by one, settles the ledger and renews the lease, and leaves the preview and the unread count alone',
    tagged.conversation?.nextMessagePosition === 2
      && tagged.conversation.messageCount === 2
      && tagged.conversation.unreadCount === untaggedTags.conversation?.unreadCount
      && tagged.conversation.previewMessageId === untagged.messageId
      && isSameJson(tagged.conversationRun?.usage, usage)
      && Date.parse(tagged.conversationRun?.leaseExpiresAt ?? '') > Date.now(),
  )
  check('a conversation tagged already is not tagged again', (await refusal(tag(untagged, 1, 2))) !== null)

  await finishConversationRun(dataConnect, { ...fence(untagged, 1), status: ConversationRunStatus.COMPLETED })

  // A member who sets the aspects before the tag lands keeps them
  const raced = await start(userIds.tagger, membershipCreatedAt)

  await claimQueuedConversationRun(dataConnect, fence(raced, 0))
  await webConnector.executeMutation(
    'UpdateConversationAspects',
    { organizationId, userId: userIds.tagger, id: raced.conversationId, aspects: [CompanyAspect.LEGAL], position: 1 },
    { impersonate: { authClaims: { sub: userIds.tagger } } },
  )

  const racedFailure = await refusal(tag(raced, 1, 2))
  const racedTags = await readTags(raced.conversationId, raced.runId, 2)

  check(
    "the member's aspects, set before the tag, are kept, and the tag is refused",
    racedFailure !== null
      && racedTags.conversation?.aspects.join() === 'LEGAL'
      && racedTags.conversation.aspectsSetBy === 'MEMBER'
      && racedTags.conversationMessages.length === 0,
  )

  await finishConversationRun(dataConnect, { ...fence(raced, 1), status: ConversationRunStatus.COMPLETED })

  // The draft's aspects, the member's, are never tagged over
  const draftedRun = await start(
    userIds.tagger,
    membershipCreatedAt,
    {},
    { aspects: [CompanyAspect.DESIGN], aspectsSetBy: ConversationActor.MEMBER },
  )

  await claimQueuedConversationRun(dataConnect, fence(draftedRun, 0))
  check(
    "a conversation started with its member's aspects is not tagged",
    (await refusal(tag(draftedRun, 1, 1))) !== null,
  )
  await finishConversationRun(dataConnect, { ...fence(draftedRun, 1), status: ConversationRunStatus.COMPLETED })

  // A conversation full, or deleted, takes no tag
  const full = await start(userIds.tagger, membershipCreatedAt)

  await claimQueuedConversationRun(dataConnect, fence(full, 0))
  await write(`mutation Fill($id: UUID!) { conversation_update(id: $id, data: { messageCount: 2000 }) }`, {
    id: full.conversationId,
  })
  check('a conversation holding 2000 entries takes no tag', (await refusal(tag(full, 1, 1))) !== null)
  await write(
    `mutation Delete($id: UUID!) { conversation_update(id: $id, data: { messageCount: 1, deletedAt_expr: "request.time" }) }`,
    { id: full.conversationId },
  )
  check('a deleted conversation takes no tag', (await refusal(tag(full, 1, 1))) !== null)
}

// One write a mutation makes, in the order it makes it, as `checkLockOrder` reads it
type Step = { name: string; kind: 'membership' | 'run' | 'conversation'; isSubagents: boolean; isLive: boolean }

// The mutations of a connector's file, each with its top-level writes in order
function readMutationSteps(path: string) {
  const text = readFileSync(path, 'utf8')
  const mutations = new Map<string, Step[]>()

  for (const match of text.matchAll(/^mutation (\w+)[\s\S]*?^\}$/gm)) {
    const [body, name] = match
    const steps: Step[] = []
    // Each top-level step starts two spaces in, an alias perhaps before it, and runs to the next
    const starts = [...body.matchAll(/^ {2}(?:\w+: )?(\w+)\(/gm)]

    for (const [index, start] of starts.entries()) {
      const field = start[1] ?? ''
      const end = starts[index + 1]?.index ?? body.length
      const stepText = body.slice(start.index, end)
      const kind = /^userOrganization_(update|updateMany|upsert)$/.test(field)
        ? 'membership'
        : /^conversationRun_update(Many)?$/.test(field)
          ? 'run'
          : /^conversation_(update|updateMany|delete|deleteMany)$/.test(field)
            ? 'conversation'
            : null

      if (!kind) continue

      steps.push({
        name: field,
        kind,
        // A parent's subagents: their rows by their parent, or named by a list of subagents
        isSubagents: /parentId: \{ eq: /.test(stepText) || /\$(deliveredS|s)ubagentIds/.test(stepText),
        // A run that goes, which a worker's fence or a stop reaches
        isLive: /status: \{ (eq: (QUEUED|RUNNING|PENDING)|in: \[[^\]]*(QUEUED|RUNNING|PENDING))/.test(stepText),
      })
    }

    mutations.set(name ?? '', steps)
  }

  return mutations
}

/*
  The one order every write on a conversation keeps, read off the operations themselves, since the
  emulator's PGlite runs one transaction at a time and no race shows there: the membership, then the
  parent's runs, the parent's row, its subagents' runs and their rows. No mutation writes the
  membership after a run or a conversation's row, nor a run that goes after its own conversation's
  row, nor a parent's subagents' runs after their rows, so no two of them wait on each other's lock
*/
// Inserts starts the daily caps count, as the mutations that start them insert theirs, in batches of
// 100, the most one insert takes, in an organization that need not exist, as one deleted since
async function seedStarts(
  userId: string,
  kind: 'CONVERSATION' | 'RUN' | 'SUBAGENT',
  count: number,
  { organization = organizationId, hoursAgo = 0 } = {},
) {
  const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
  const rows = Array.from({ length: count }, () => ({ userId, organizationId: organization, kind, createdAt }))

  for (let index = 0; index < rows.length; index += 100) {
    await write(
      `mutation SeedStarts($rows: [CappedStart_Data!]!) {
        cappedStart_insertMany(data: $rows)
      }`,
      { rows: rows.slice(index, index + 100) },
    )
  }
}

// A message sent to a conversation whose run ended, as the backend sends it
async function sendTo(started: Started, position: number, runNumber: number, overrides: Variables = {}) {
  return sendConversationMessage(dataConnect, {
    organizationId,
    userId: started.userId,
    conversationId: started.conversationId,
    membershipCreatedAt: started.membershipCreatedAt,
    messageId: createId(),
    text: 'Capped',
    preview: { kind: 'MEMBER_TEXT', text: 'Capped' },
    position,
    runId: createId(),
    runNumber,
    content: '[]',
    transcriptPosition: 1,
    ...overrides,
  })
}

// What one run may have cost, as a write of its ledger upserts it, or as the sweep finds one a day old
async function insertSpend(userId: string, costBound: number, { organization = organizationId, hoursAgo = 0 } = {}) {
  const runId = createId()

  await write(
    `mutation SeedSpend($runId: UUID!, $userId: String!, $organizationId: UUID!, $costBound: Int64!, $spentAt: Timestamp!) {
      runSpend_insert(
        data: { runId: $runId, userId: $userId, organizationId: $organizationId, costBound: $costBound, spentAt: $spentAt }
      )
    }`,
    {
      runId,
      userId,
      organizationId: organization,
      costBound: String(costBound),
      spentAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
    },
  )

  return runId
}

async function readSpend(runId: string) {
  const data = await read<{ runSpend: { costBound: string; spentAt: string } | null }>(
    `query ReadSpend($runId: UUID!) { runSpend(key: { runId: $runId }) { costBound spentAt } }`,
    { runId },
  )

  return data.runSpend
}

/*
  What each run may have cost (`RunSpend`), which every write of a run's ledger upserts beside it and
  the daily spend ceilings sum: the reservation's write counting it before its request goes, a
  settlement lowering it, a write sent no bound keeping it as its time moves on, one refused for its
  fence recording nothing, the sums of the member's, the account's and the organization's last 24
  hours as Int64 strings, null over none, the run's own row apart, each scope's rows oldest first, a
  deleted conversation's and a deleted organization's kept, and the sweep deleting those over a day
*/
async function checkDailySpend() {
  const userId = userIds.spender
  const member = { organizationId, userId }
  const empty = await getDailySpend(dataConnect, member)

  check(
    "a day nothing was spent in sums to null for the member and the account, the organization's holding the other checks' runs",
    empty.data.member[0]?.costBound_sum == null
      && empty.data.account[0]?.costBound_sum == null
      && empty.data.organization[0]?.costBound_sum != null,
  )

  const started = await start(userId, await readMembershipCreatedAt(userId))
  const ledger = { requests: [], byModel: {} }

  await claimQueuedConversationRun(dataConnect, fence(started, 0))
  await recordConversationRunUsage(dataConnect, { ...fence(started, 1), usage: ledger, costBound: '3900000' })

  const reserved = await getRunDailySpend(dataConnect, { ...member, runId: started.runId })

  check(
    "the reservation's write records what the run may have cost, summed by member and account, its own row apart",
    reserved.data.member[0]?.costBound_sum === '3900000'
      && reserved.data.account[0]?.costBound_sum === '3900000'
      && Number(reserved.data.organization[0]?.costBound_sum) >= 3_900_000
      && reserved.data.own[0]?.costBound === '3900000',
  )
  check(
    'a write of the ledger refused for its fence records nothing',
    (await isRefused(
      recordConversationRunUsage(dataConnect, { ...fence(started, 7), usage: ledger, costBound: '9000000' }),
      "The run is no longer this worker's",
    )) && (await readSpend(started.runId))?.costBound === '3900000',
  )

  await storeConversationTurn(dataConnect, {
    ...fence(started, 1),
    entryId: createId(),
    position: 1,
    content: '[]',
    usage: ledger,
    costBound: '20000',
  })

  const settled = await readSpend(started.runId)

  check('a settlement lowers what the run may have cost', settled?.costBound === '20000')

  await finishConversationRun(dataConnect, {
    ...fence(started, 1),
    status: ConversationRunStatus.COMPLETED,
    usage: ledger,
  })

  const ended = await readSpend(started.runId)

  check(
    'a write of the ledger from before M39, with no bound, keeps the one recorded and moves its time on',
    ended?.costBound === '20000' && !!settled && Date.parse(ended.spentAt) >= Date.parse(settled.spentAt),
  )

  await write(`mutation DeleteSpent($id: UUID!) { conversation_delete(id: $id) }`, { id: started.conversationId })

  check('what a run may have cost outlives its conversation', (await readSpend(started.runId))?.costBound === '20000')

  // The account's runs in an organization deleted since, a teammate's in this one, and a day-old run
  await insertSpend(userId, 5_000_000, { organization: createId() })
  await insertSpend(userIds.cosigner, 7_000_000)
  await insertSpend(userId, 1_000_000, { hoursAgo: 3 })
  await insertSpend(userId, 2_000_000, { hoursAgo: 2 })

  const expired = await insertSpend(userId, 40_000_000, { hoursAgo: 25 })
  const day = await getDailySpend(dataConnect, member)
  const organizationDay = Number(day.data.organization[0]?.costBound_sum)

  check(
    "the sums take the member's runs in the organization, the account's elsewhere, a deleted organization's too, and the organization's whoever ran them, within 24 hours",
    day.data.member[0]?.costBound_sum === '3020000'
      && day.data.account[0]?.costBound_sum === '8020000'
      && organizationDay >= 10_020_000,
  )

  const rows = await getDailySpendRows(dataConnect, member)

  check(
    "a scope's rows come oldest first, so the oldest leave the window first",
    rows.data.member.map(({ costBound }) => costBound).join() === '1000000,2000000,20000'
      && rows.data.account.length === 4,
  )

  const { data: pruned } = await deleteExpiredRunSpends(dataConnect)

  check(
    'the sweep deletes what runs that last spent over a day ago may have cost, and keeps the rest',
    pruned.runSpend_deleteMany >= 1
      && (await readSpend(expired)) === null
      && (await readSpend(started.runId))?.costBound === '20000',
  )
}

/*
  The daily caps, which every mutation that starts a conversation, a run or a subagent counts on the
  `CappedStart` rows of the 24 hours before it: the member's under the membership's lock, so two
  sends at once cannot both take the last place, and the account's and the organization's without
  one. Checked last, since the organization's rows it inserts would refuse every start after it
*/
async function checkDailyCaps() {
  const capperCreatedAt = await readMembershipCreatedAt(userIds.capper)
  const first = await start(userIds.capper, capperCreatedAt)
  const counted = await getCappedStarts(dataConnect, { organizationId, userId: userIds.capper })

  check(
    'a conversation started counts a conversation and a run, both inserted by the one mutation',
    counted.data.memberConversations.length === 1 && counted.data.memberRuns.length === 1,
  )

  await seedStarts(userIds.capper, 'RUN', 1, { hoursAgo: 25 })

  check(
    'a start over 24 hours old counts no more',
    (await getCappedStarts(dataConnect, { organizationId, userId: userIds.capper })).data.memberRuns.length === 1,
  )

  const second = await start(userIds.capper, capperCreatedAt)

  await complete(first)
  await complete(second)
  // 97 more, with the two runs started, leave one place of the member's 100
  await seedStarts(userIds.capper, 'RUN', 97)

  const outcomes = await Promise.all([first, second].map(started => refusal(sendTo(started, 1, 1))))

  check(
    'two sends at once at the member’s cap on runs let exactly one through',
    outcomes.filter(o => o === null).length === 1,
  )
  check(
    'the other is refused by the member’s cap',
    outcomes.some(outcome => outcome?.includes('Somebody starts at most 100 runs in 24 hours in an organization')),
  )

  const sent = outcomes[0] === null ? first : second
  const refused = sent === first ? second : first
  const newest = (await getCappedStarts(dataConnect, { organizationId, userId: userIds.capper })).data.memberRuns

  check(
    'the counts read the newest starts first',
    newest.length === 100 && newest.every((row, index) => index === 0 || newest[index - 1]!.createdAt >= row.createdAt),
  )
  check(
    'a send the caps are lifted for, as the development backend sends it, goes through at the cap',
    (await refusal(sendTo(refused, 1, 1, { isUsageCapped: false }))) === null,
  )

  // An account at its 200 across organizations, those of an organization deleted since counted
  const travelerCreatedAt = await readMembershipCreatedAt(userIds.traveler)
  const traveler = await start(userIds.traveler, travelerCreatedAt)

  await complete(traveler)
  await seedStarts(userIds.traveler, 'RUN', 199, { organization: createId() })

  check(
    'the account’s 200 runs across its organizations refuse a send in another',
    await isRefused(sendTo(traveler, 1, 1), 'An account starts at most 200 runs in 24 hours across its organizations'),
  )

  // An organization at its 500, the member's own count low
  const organizerCreatedAt = await readMembershipCreatedAt(userIds.organizer)
  const organizer = await start(userIds.organizer, organizerCreatedAt)

  await complete(organizer)
  await seedStarts(userIds.teammate, 'RUN', 500)

  check(
    'the organization’s 500 runs refuse a send of a member who started one',
    await isRefused(sendTo(organizer, 1, 1), 'An organization starts at most 500 runs in 24 hours'),
  )
  check(
    'the organization’s 100 conversations refuse a start',
    await isRefused(
      (async () => {
        await seedStarts(userIds.teammate, 'CONVERSATION', 100)
        await start(userIds.organizer, organizerCreatedAt)
      })(),
      'An organization starts at most 100 conversations in 24 hours',
    ),
  )
}

type StopRequest = { stopRequestedAt: string | null }

async function readStopRequestedAt(runId: string) {
  const data = await read<{ conversationRun: StopRequest | null }>(
    `query ReadStopRequest($id: UUID!) { conversationRun(id: $id) { stopRequestedAt } }`,
    { id: runId },
  )

  return data.conversationRun?.stopRequestedAt ?? null
}

// A subagent of a conversation, its run waiting for a slot, as a pending launch leaves one
async function insertPendingSubagent(started: Started, inOrganizationId: string) {
  const subagentId = createId()
  const runId = createId()

  await write(
    `mutation InsertPendingSubagent(
      $id: UUID!, $userId: String!, $organizationId: UUID!, $parentId: UUID!, $runId: UUID!, $membershipCreatedAt: Timestamp!
    ) @transaction {
      conversation_insert(data: { id: $id, userId: $userId, organizationId: $organizationId, parentId: $parentId, title: "Checked subagent" })
      conversationRun_insert(data: {
        id: $runId, conversationId: $id, number: 0, trigger: LAUNCH, status: PENDING, membershipCreatedAt: $membershipCreatedAt, anchorPosition: 0
      })
    }`,
    {
      id: subagentId,
      userId: started.userId,
      organizationId: inOrganizationId,
      parentId: started.conversationId,
      runId,
      membershipCreatedAt: started.membershipCreatedAt,
    },
  )

  return runId
}

async function checkSuspension() {
  await write(
    `mutation SetUpSuspended($id: UUID!, $suspended: String!, $bystander: String!) @transaction {
      organization_insert(data: { id: $id, name: "Checked suspended organization" })
      suspended: userOrganization_insert(data: { userId: $suspended, organizationId: $id, role: MEMBER })
      bystander: userOrganization_insert(data: { userId: $bystander, organizationId: $id, role: MEMBER })
    }`,
    { id: suspendedOrganizationId, suspended: userIds.suspended, bystander: userIds.bystander },
  )

  // In the first organization, the suspended account's run queued, another running with a subagent
  // waiting for a slot, and a bystander's run queued
  const queued = await start(userIds.suspended, await readMembershipCreatedAt(userIds.suspended))
  const running = await start(userIds.suspended, queued.membershipCreatedAt)

  await claimQueuedConversationRun(dataConnect, fence(running, 0))

  const pendingRunId = await insertPendingSubagent(running, organizationId)
  const bystander = await start(userIds.bystander, await readMembershipCreatedAt(userIds.bystander))
  const suspension = await suspendUserConversations(dataConnect, { userId: userIds.suspended })

  check(
    'suspending an account asks its runs in flight to stop, its own and its subagents’, and answers how many',
    suspension.data.runs === 2
      && suspension.data.subagentRuns === 1
      && Boolean(await readStopRequestedAt(queued.runId))
      && Boolean(await readStopRequestedAt(running.runId))
      && Boolean(await readStopRequestedAt(pendingRunId)),
  )
  check('suspending an account leaves another member’s runs going', !(await readStopRequestedAt(bystander.runId)))

  const { data: context } = await getConversationRunContext(dataConnect, {
    organizationId,
    userId: userIds.suspended,
    conversationId: queued.conversationId,
    runId: queued.runId,
  })
  const { data: routed } = await getConversationsSuspension(dataConnect, { organizationId, userId: userIds.suspended })

  check(
    'a run’s context and the routes’ read say the account is suspended, and the organization not',
    Boolean(context.user?.conversationsSuspendedAt)
      && !context.organization?.conversationsSuspendedAt
      && Boolean(routed.user?.conversationsSuspendedAt)
      && !routed.organization?.conversationsSuspendedAt,
  )
  check(
    'suspending an account nobody has is refused',
    await isRefused(
      suspendUserConversations(dataConnect, { userId: `${userIds.suspended}-nobody` }),
      'No such account',
    ),
  )

  await liftUserConversationsSuspension(dataConnect, { userId: userIds.suspended })

  check(
    'lifting an account’s suspension clears it, and leaves its runs asked to stop',
    !(await getConversationsSuspension(dataConnect, { organizationId, userId: userIds.suspended })).data.user
      ?.conversationsSuspendedAt && Boolean(await readStopRequestedAt(queued.runId)),
  )

  // In the second organization, both members' runs, the bystander's in the first going on
  const membership = async (userId: string) =>
    (
      await getConversationSendContext(dataConnect, {
        organizationId: suspendedOrganizationId,
        userId,
        conversationId: createId(),
        messageId: createId(),
      })
    ).data.userOrganization?.createdAt ?? ''
  const startThere = async (userId: string) => {
    const started: Started = {
      userId,
      membershipCreatedAt: await membership(userId),
      conversationId: createId(),
      messageId: createId(),
      runId: createId(),
    }

    await startConversation(dataConnect, {
      ...started,
      organizationId: suspendedOrganizationId,
      title: 'Checked conversation',
      text: 'Checked message',
      preview: { kind: 'MEMBER_TEXT', text: 'Checked message' },
      content: JSON.stringify([{ type: 'text', text: 'Checked message' }]),
    })

    return started
  }
  const theirs = await startThere(userIds.suspended)
  const bystanders = await startThere(userIds.bystander)
  const theirPendingRunId = await insertPendingSubagent(theirs, suspendedOrganizationId)
  const organizationSuspension = await suspendOrganizationConversations(dataConnect, {
    organizationId: suspendedOrganizationId,
  })

  check(
    'suspending an organization asks every member’s runs in flight there to stop, and nobody’s elsewhere',
    organizationSuspension.data.runs === 2
      && organizationSuspension.data.subagentRuns === 1
      && Boolean(await readStopRequestedAt(theirs.runId))
      && Boolean(await readStopRequestedAt(bystanders.runId))
      && Boolean(await readStopRequestedAt(theirPendingRunId))
      && !(await readStopRequestedAt(bystander.runId)),
  )
  check(
    'the routes’ read says the organization is suspended, for any member of it',
    Boolean(
      (
        await getConversationsSuspension(dataConnect, {
          organizationId: suspendedOrganizationId,
          userId: userIds.bystander,
        })
      ).data.organization?.conversationsSuspendedAt,
    ),
  )

  await liftOrganizationConversationsSuspension(dataConnect, { organizationId: suspendedOrganizationId })

  check(
    'lifting an organization’s suspension clears it',
    !(
      await getConversationsSuspension(dataConnect, {
        organizationId: suspendedOrganizationId,
        userId: userIds.bystander,
      })
    ).data.organization?.conversationsSuspendedAt,
  )
}

function checkLockOrder() {
  const connectors = ['strategydance-backend-connector', 'strategydance-web-connector'].map(connector =>
    readMutationSteps(new URL(`../../strategydance-database/${connector}/mutations.gql`, import.meta.url).pathname),
  )
  const disordered: string[] = []

  for (const mutations of connectors) {
    for (const [name, steps] of mutations) {
      for (const [index, step] of steps.entries()) {
        const before = steps.slice(0, index)

        if (step.kind === 'membership' && before.some(({ kind }) => kind !== 'membership')) disordered.push(name)
        if (
          step.kind === 'run'
          && step.isLive
          && !step.isSubagents
          && before.some(({ kind, isSubagents }) => kind === 'conversation' && !isSubagents)
        ) {
          disordered.push(name)
        }
        if (
          step.kind === 'run'
          && step.isSubagents
          && before.some(({ kind, isSubagents }) => kind === 'conversation' && isSubagents)
        ) {
          disordered.push(name)
        }
      }
    }
  }

  check(
    'no mutation writes the membership after a run or a row, a live run after its row, or a subagent’s run after its row',
    disordered.length === 0,
  )

  for (const name of new Set(disordered)) console.log(`        out of order: ${name}`)

  check(
    'the lock order reads the cascades it guards',
    [
      'DeleteConversation',
      'RetryConversationRun',
      'RequestConversationRunStopWithSubagents',
      'StartSubagentReaction',
      'SuspendUserConversations',
      'SuspendOrganizationConversations',
    ].every(name => connectors.some(mutations => (mutations.get(name)?.length ?? 0) > 0)),
  )
}

checkLockOrder()

try {
  await setUp()

  const started = await checkStarting()

  await checkClaiming(started)
  await checkFinishing()
  await checkMembership()
  await checkDeadRuns()
  await checkStopping()
  await checkResuming()
  await checkRetrying()
  await checkQueuedLeases()
  // The claiming checks leave the sender's conversation idle, its next position 2 and its next run 1
  await checkSending(started)
  await checkCaps()
  await checkPruning()
  await checkSweeping()
  await checkReplies()
  await checkQuestions()
  await checkSettling()
  await checkTagging()
  await checkIntegrationCalls()
  await checkApprovals()
  // Before the caps' checks, which fill the organization's daily caps
  await checkSuspension()
  await checkDailySpend()
  await checkDailyCaps()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')
