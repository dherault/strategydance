import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  CompanyAspect,
  ConversationActor,
  ConversationRunStatus,
  type LaunchSubagentForAgentVariables,
  claimQueuedConversationRun,
  connectorConfig,
  getConversationSendContext,
  getSubagentForAgent,
  getSubagentLauncherForAgent,
  getSubagentWritesForAgent,
  launchPendingSubagentForAgent,
  launchSubagentForAgent,
  listSubagentsForAgent,
  requestSubagentRunStopForAgent,
  startConversation,
  stopQueuedSubagentRun,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the Subagents module's operations against the emulators, where CI cannot, since what they
  guard is in their SQL conditions:

    bun run check:subagents-module

  It makes a throwaway organization with two members, starts a conversation whose run it claims, as
  a worker does, and launches subagents from that run through the backend connector's own
  operations, as the module calls them: its call's key stored, the run launching it checked still
  running, not asked to stop and on its anchor, the ten on an anchor and the hundred counted. Then it
  lists and reads them as the module does, on the member and the parent, with the writes a subagent's
  scope keeps, and asks their runs to stop, queued, running and waiting for a slot, a chained one and
  another conversation's refused, and ends a queued one asked to stop. It removes everything it made,
  then exits non-zero naming each check that failed. The module's tests run against a fake of these
  operations: this is what says the fake's conditions are the SQL's.

  Like `checkSubagentRuns.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:subagents-module`',
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

const userIds = {
  author: `check-subagents-module-${checkId}-author`,
  other: `check-subagents-module-${checkId}-other`,
}

// What a write without an idempotency key sends for its key's variables
const UNKEYED = {
  isKeyed: false,
  idempotencyScope: '',
  idempotencyKey: '',
  tool: '',
  argumentsHash: '',
  result: '',
  expiresAt: null,
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

// Whether an operation was refused for the cause named, printing any other cause it was refused for
async function isRefused(operation: Promise<unknown>, cause: string) {
  const actual = await refusal(operation)

  if (actual !== null && !actual.includes(cause)) console.log(`        refused otherwise: ${actual}`)

  return actual?.includes(cause) ?? false
}

type StoredConversation = {
  parentId: string | null
  activeRunId: string | null
  nextMessagePosition: number
  subagentCount: number
  report: string | null
  reportedAt: string | null
  launchRunId: string | null
  launchToolUseId: string | null
  launchAnchorPosition: number | null
}

async function readConversation(id: string) {
  const data = await read<{ conversation: StoredConversation | null }>(
    `query ReadConversation($id: UUID!) {
      conversation(id: $id) {
        parentId activeRunId nextMessagePosition subagentCount report reportedAt launchRunId launchToolUseId launchAnchorPosition
      }
    }`,
    { id },
  )

  return data.conversation
}

type StoredRun = { status: string; stopRequestedAt: string | null; leaseExpiresAt: string | null }

async function readRun(id: string) {
  const data = await read<{ conversationRun: StoredRun | null }>(
    `query ReadRun($id: UUID!) { conversationRun(id: $id) { status stopRequestedAt leaseExpiresAt } }`,
    { id },
  )

  return data.conversationRun
}

// Writes a run's or a conversation's columns as a check needs them, which no operation writes so
async function updateRun(id: string, data: string) {
  await write(`mutation UpdateRun($id: UUID!) { conversationRun_update(id: $id, data: { ${data} }) }`, { id })
}

async function updateConversation(id: string, data: string) {
  await write(`mutation UpdateConversation($id: UUID!) { conversation_update(id: $id, data: { ${data} }) }`, { id })
}

// What a call's key keeps, by its scope and its key
async function readCallResult(idempotencyScope: string, idempotencyKey: string) {
  const data = await read<{ moduleCallResult: { tool: string } | null }>(
    `query ReadCallResult($idempotencyScope: String!, $idempotencyKey: String!) {
      moduleCallResult(key: { idempotencyScope: $idempotencyScope, idempotencyKey: $idempotencyKey }) { tool }
    }`,
    { idempotencyScope, idempotencyKey },
  )

  return data.moduleCallResult
}

// Keeps a write a subagent's run made through a module, as the module's mutation keeps its key
async function insertCallResult(idempotencyScope: string, idempotencyKey: string, tool: string, result: object) {
  await write(
    `mutation InsertCallResult(
      $idempotencyScope: String!
      $idempotencyKey: String!
      $userId: String!
      $organizationId: UUID!
      $tool: String!
      $result: String!
    ) {
      moduleCallResult_insert(data: {
        idempotencyScope: $idempotencyScope, idempotencyKey: $idempotencyKey, userId: $userId,
        organizationId: $organizationId, tool: $tool, argumentsHash: "hash", result: $result
      })
    }`,
    { idempotencyScope, idempotencyKey, userId: userIds.author, organizationId, tool, result: JSON.stringify(result) },
  )
}

/*
  Ends every run of the author's in flight, a parent's or a subagent's, which no check after reads,
  so a section starts parents within the member's three runs and launches into free slots whatever
  the ones before it left going
*/
async function settleRuns() {
  await write(
    `mutation Settle($organizationId: UUID!, $userId: String!) {
      conversationRun_updateMany(
        where: {
          status: { in: [QUEUED, RUNNING, PENDING] }
          conversation: { userId: { eq: $userId }, organizationId: { eq: $organizationId } }
        }
        data: { status: COMPLETED, leaseExpiresAt: null }
      )
    }`,
    { organizationId, userId: userIds.author },
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

type Parent = { conversationId: string; runId: string; membershipCreatedAt: string; scope: string }

// Starts a conversation of the author's and claims its run, as a worker does, which then calls the
// module as its launcher
async function startRunningParent(): Promise<Parent> {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.author)
  const parent = { conversationId: createId(), runId: createId(), membershipCreatedAt }
  const fence = { organizationId, userId: userIds.author, conversationId: parent.conversationId, runId: parent.runId }

  await startConversation(dataConnect, {
    ...fence,
    membershipCreatedAt,
    messageId: createId(),
    title: 'Checked parent',
    text: 'Checked message',
    preview: { kind: 'MEMBER_TEXT', text: 'Checked message' },
    content: JSON.stringify([{ type: 'text', text: 'Checked message' }]),
    aspects: [CompanyAspect.FINANCES],
    aspectsSetBy: ConversationActor.MEMBER,
  })
  await claimQueuedConversationRun(dataConnect, { ...fence, attempts: 0, membershipCreatedAt })

  return { ...parent, scope: `conversation:${parent.conversationId}` }
}

type Subagent = { conversationId: string; runId: string }

// The variables `LaunchSubagentForAgent` takes, for a subagent launched from the parent's run, under
// a key of its own unless a check says otherwise
function launchVariables(parent: Parent, overrides: Partial<LaunchSubagentForAgentVariables> = {}) {
  const subagent: Subagent = { conversationId: createId(), runId: createId() }
  const key = `toolu_${createId()}`

  return {
    subagent,
    key,
    variables: {
      organizationId,
      userId: userIds.author,
      membershipCreatedAt: parent.membershipCreatedAt,
      parentId: parent.conversationId,
      anchorPosition: 0,
      launchRunId: parent.runId,
      launchToolUseId: key,
      ...subagent,
      messageId: createId(),
      title: 'Research the competitors',
      text: 'Compare the pricing pages',
      content: JSON.stringify([{ type: 'text', text: 'Compare the pricing pages' }]),
      attachmentIds: [],
      isKeyed: true,
      idempotencyScope: parent.scope,
      idempotencyKey: key,
      tool: 'launch_subagent',
      argumentsHash: 'hash',
      result: JSON.stringify({ id: subagent.conversationId }),
      expiresAt: null,
      ...overrides,
    } satisfies LaunchSubagentForAgentVariables,
  }
}

// Launches a subagent as the module does, into a free slot, or waiting for one once five are taken
async function launch(parent: Parent, { isPending = false } = {}) {
  const { subagent, variables } = launchVariables(parent)

  await (isPending ? launchPendingSubagentForAgent : launchSubagentForAgent)(dataConnect, variables)

  return subagent
}

// The variables `RequestSubagentRunStopForAgent` takes, to stop a subagent's run from the parent's
function stopVariables(parent: Parent, subagent: Subagent, runId = subagent.runId) {
  return {
    organizationId,
    userId: userIds.author,
    membershipCreatedAt: parent.membershipCreatedAt,
    parentId: parent.conversationId,
    launchRunId: parent.runId,
    conversationId: subagent.conversationId,
    runId,
    ...UNKEYED,
  }
}

function asCaller(parent: Parent, userId = userIds.author) {
  return { organizationId, userId, membershipCreatedAt: parent.membershipCreatedAt }
}

async function checkLauncher() {
  const parent = await startRunningParent()
  const { data } = await getSubagentLauncherForAgent(dataConnect, {
    ...asCaller(parent),
    conversationId: parent.conversationId,
    runId: parent.runId,
  })

  check(
    'the launcher reads the run calling, running, on its anchor, its conversation no subagent',
    data.membership.length === 1
      && data.runs[0]?.status === ConversationRunStatus.RUNNING
      && data.runs[0].anchorPosition === 0
      && data.runs[0].conversation.parentId === null,
  )

  const otherMembership = await readMembershipCreatedAt(userIds.other)
  const { data: other } = await getSubagentLauncherForAgent(dataConnect, {
    organizationId,
    userId: userIds.other,
    membershipCreatedAt: otherMembership,
    conversationId: parent.conversationId,
    runId: parent.runId,
  })

  check('the launcher reads no run of somebody else’s', other.membership.length === 1 && other.runs.length === 0)

  const subagent = await launch(parent)
  const { data: fromSubagent } = await getSubagentLauncherForAgent(dataConnect, {
    ...asCaller(parent),
    conversationId: subagent.conversationId,
    runId: subagent.runId,
  })

  check(
    'the launcher reads a subagent’s run with its parent',
    fromSubagent.runs[0]?.conversation.parentId === parent.conversationId,
  )
}

async function checkLaunching() {
  const parent = await startRunningParent()
  const { subagent, key, variables } = launchVariables(parent)

  await launchSubagentForAgent(dataConnect, variables)

  const stored = await readConversation(subagent.conversationId)

  check(
    'a launch from a running run makes a subagent naming the run and the call',
    stored?.parentId === parent.conversationId
      && stored.launchRunId === parent.runId
      && stored.launchToolUseId === key
      && stored.launchAnchorPosition === 0
      && (await readRun(subagent.runId))?.status === ConversationRunStatus.QUEUED,
  )
  check(
    'a launch keeps its call’s key in the conversation’s scope',
    (await readCallResult(parent.scope, key))?.tool === 'launch_subagent',
  )

  // Postgres reports the key, which the insert after the membership's lock violates, before the
  // subagent's own: the launch is refused whole, and the module answers from the key
  const { variables: again } = launchVariables(parent, {
    conversationId: subagent.conversationId,
    idempotencyKey: key,
    launchToolUseId: key,
  })

  check(
    'a launch called again with its key is refused on the key, changing nothing',
    (await isRefused(launchSubagentForAgent(dataConnect, again), 'module_call_result_pkey'))
      && (await readConversation(parent.conversationId))?.subagentCount === 1,
  )

  const unkeyed = launchVariables(parent, UNKEYED)

  await launchSubagentForAgent(dataConnect, unkeyed.variables)

  check(
    'a launch without a key makes its subagent and keeps no key',
    (await readConversation(unkeyed.subagent.conversationId))?.parentId === parent.conversationId
      && (await readCallResult(parent.scope, '')) === null,
  )

  check(
    'a launch from another anchor than its run’s is refused',
    await isRefused(
      launchSubagentForAgent(dataConnect, launchVariables(parent, { anchorPosition: 1 }).variables),
      'The run launching the subagent has ended or was asked to stop',
    ),
  )

  const pending = launchVariables(parent)

  await launchPendingSubagentForAgent(dataConnect, pending.variables)

  check(
    'a pending launch keeps its key and waits for a slot with no lease',
    (await readRun(pending.subagent.runId))?.status === ConversationRunStatus.PENDING
      && (await readRun(pending.subagent.runId))?.leaseExpiresAt === null
      && (await readCallResult(parent.scope, pending.key))?.tool === 'launch_subagent',
  )

  await updateRun(parent.runId, 'stopRequestedAt_expr: "request.time"')

  const stopped = launchVariables(parent)

  check(
    'a launch from a run asked to stop is refused, its key with it',
    (await isRefused(
      launchSubagentForAgent(dataConnect, stopped.variables),
      'The run launching the subagent has ended or was asked to stop',
    ))
      && (await readCallResult(parent.scope, stopped.key)) === null
      && (await readConversation(parent.conversationId))?.subagentCount === 3,
  )

  await updateRun(parent.runId, 'stopRequestedAt: null, status: COMPLETED')

  check(
    'a launch from a run that has ended is refused',
    await isRefused(
      launchSubagentForAgent(dataConnect, launchVariables(parent).variables),
      'The run launching the subagent has ended or was asked to stop',
    ),
  )
}

async function checkCounting() {
  const parent = await startRunningParent()

  for (let index = 0; index < 10; index++) await launch(parent, { isPending: true })

  check(
    'a launch past the ten on its run’s anchor is refused',
    await isRefused(
      launchPendingSubagentForAgent(dataConnect, launchVariables(parent).variables),
      'A parent launches at most 10 subagents on one anchor',
    ),
  )

  await updateConversation(parent.conversationId, 'subagentCount: 100')

  check(
    'a launch past the hundred a conversation holds is refused',
    await isRefused(
      launchPendingSubagentForAgent(dataConnect, launchVariables(parent, { anchorPosition: 0 }).variables),
      'The parent launches no more subagents',
    ),
  )
}

async function checkReading() {
  const parent = await startRunningParent()
  const first = await launch(parent)
  const second = await launch(parent)
  const deleted = await launch(parent)
  const other = await startRunningParent()

  await launch(other)
  await updateConversation(deleted.conversationId, 'deletedAt_expr: "request.time"')

  const { data: listed } = await listSubagentsForAgent(dataConnect, {
    ...asCaller(parent),
    parentId: parent.conversationId,
  })

  check(
    'the list reads the parent’s live subagents, newest first, each with its latest run',
    listed.membership.length === 1
      && listed.subagents.map(({ id }) => id).join() === [second.conversationId, first.conversationId].join()
      && listed.subagents.every(({ latestRuns }) => latestRuns[0]?.status === ConversationRunStatus.QUEUED),
  )

  const otherMembership = await readMembershipCreatedAt(userIds.other)
  const { data: theirs } = await listSubagentsForAgent(dataConnect, {
    organizationId,
    userId: userIds.other,
    membershipCreatedAt: otherMembership,
    parentId: parent.conversationId,
  })

  check('the list reads nothing of somebody else’s', theirs.subagents.length === 0)

  const { data: read } = await getSubagentForAgent(dataConnect, {
    ...asCaller(parent),
    parentId: parent.conversationId,
    id: first.conversationId,
  })

  check(
    'the read reads one subagent with its run, busy with it, and how many runs it took',
    read.subagents[0]?.activeRunId === first.runId
      && read.subagents[0].latestRuns[0]?.id === first.runId
      && read.subagents[0].runCount[0]?._count === 1,
  )

  for (const [name, id, parentId] of [
    ['a subagent a retry deleted', deleted.conversationId, parent.conversationId],
    ['another conversation’s subagent', first.conversationId, other.conversationId],
  ] as const) {
    const { data } = await getSubagentForAgent(dataConnect, { ...asCaller(parent), parentId, id })

    check(`the read reads ${name} as none`, data.subagents.length === 0)
  }

  const scope = `conversation:${first.conversationId}`

  for (const [index, tool] of ['create_task', 'update_document', 'delete_task'].entries()) {
    await insertCallResult(scope, `toolu_${index}`, tool, { id: createId() })
  }

  await insertCallResult(parent.scope, 'toolu_parent', 'create_task', { id: createId() })

  const { data: firstPage } = await getSubagentWritesForAgent(dataConnect, {
    ...asCaller(parent),
    scope,
    afterCreatedAt: '1970-01-01T00:00:00Z',
    afterKey: '',
  })

  check(
    'the writes read what the subagent’s scope keeps, oldest first, with their count',
    firstPage.writes.map(({ tool }) => tool).join() === 'create_task,update_document,delete_task'
      && firstPage.total[0]?._count === 3,
  )

  const cursor = firstPage.writes[0]!
  const { data: nextPage } = await getSubagentWritesForAgent(dataConnect, {
    ...asCaller(parent),
    scope,
    afterCreatedAt: cursor.createdAt,
    afterKey: cursor.idempotencyKey,
  })

  check(
    'the writes read past a cursor, the instant it holds matching itself',
    nextPage.writes.map(({ tool }) => tool).join() === 'update_document,delete_task',
  )

  const { data: theirWrites } = await getSubagentWritesForAgent(dataConnect, {
    organizationId,
    userId: userIds.other,
    membershipCreatedAt: otherMembership,
    scope,
    afterCreatedAt: '1970-01-01T00:00:00Z',
    afterKey: '',
  })

  check('the writes read nothing of somebody else’s', theirWrites.writes.length === 0)
}

async function checkStopping() {
  const parent = await startRunningParent()
  const queued = await launch(parent)
  const running = await launch(parent)
  const key = `toolu_${createId()}`

  await claimQueuedConversationRun(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: running.conversationId,
    runId: running.runId,
    attempts: 0,
    membershipCreatedAt: parent.membershipCreatedAt,
  })

  await requestSubagentRunStopForAgent(dataConnect, {
    ...stopVariables(parent, queued),
    isKeyed: true,
    idempotencyScope: parent.scope,
    idempotencyKey: key,
    tool: 'stop_subagent',
    argumentsHash: 'hash',
    result: '{}',
  })

  check(
    'a stop asks a queued subagent’s run to stop, keeping its key',
    (await readRun(queued.runId))?.stopRequestedAt !== null
      && (await readCallResult(parent.scope, key))?.tool === 'stop_subagent',
  )

  check(
    'a stop of a run asked to stop already is refused',
    await isRefused(
      requestSubagentRunStopForAgent(dataConnect, stopVariables(parent, queued)),
      "The subagent's run is no longer the one to stop",
    ),
  )

  await requestSubagentRunStopForAgent(dataConnect, stopVariables(parent, running))

  check(
    'a stop asks a running subagent’s run to stop, leaving it running',
    (await readRun(running.runId))?.status === ConversationRunStatus.RUNNING
      && (await readRun(running.runId))?.stopRequestedAt !== null,
  )

  const pending = await launch(parent, { isPending: true })

  await requestSubagentRunStopForAgent(dataConnect, stopVariables(parent, pending))

  check(
    'a stop asks a subagent’s run waiting for a slot to stop',
    (await readRun(pending.runId))?.stopRequestedAt !== null,
  )

  const chained = await launch(parent)

  await updateRun(chained.runId, 'status: CHAINED')

  check(
    'a stop of a run that chained since is refused, for the module to read the next',
    await isRefused(
      requestSubagentRunStopForAgent(dataConnect, stopVariables(parent, chained)),
      "The subagent's run is no longer the one to stop",
    ),
  )

  const other = await startRunningParent()
  const theirs = await launch(other)

  check(
    'a stop of another conversation’s subagent is refused',
    await isRefused(
      requestSubagentRunStopForAgent(dataConnect, stopVariables(parent, theirs)),
      "The subagent's run is no longer the one to stop",
    ),
  )

  const deleted = await launch(parent)

  await updateConversation(deleted.conversationId, 'deletedAt_expr: "request.time"')

  check(
    'a stop of a subagent a retry deleted is refused',
    await isRefused(
      requestSubagentRunStopForAgent(dataConnect, stopVariables(parent, deleted)),
      "The subagent's run is no longer the one to stop",
    ),
  )

  const conversation = await readConversation(queued.conversationId)
  const note = {
    organizationId,
    userId: userIds.author,
    conversationId: queued.conversationId,
    runId: queued.runId,
    noteId: createId(),
    position: conversation?.nextMessagePosition ?? 0,
    preview: { kind: 'NOTE', noteKind: 'STOPPED' },
    failure: 'Checked',
    report: 'This subagent was stopped before it finished.',
  }
  const notAsked = await launch(other)

  check(
    'ending a queued run is refused while nobody asked it to stop',
    await isRefused(
      stopQueuedSubagentRun(dataConnect, {
        ...note,
        conversationId: notAsked.conversationId,
        runId: notAsked.runId,
        position: (await readConversation(notAsked.conversationId))?.nextMessagePosition ?? 0,
      }),
      'The run is no longer queued to be stopped',
    ),
  )

  await stopQueuedSubagentRun(dataConnect, note)

  const ended = await readConversation(queued.conversationId)

  check(
    'a queued run asked to stop ends stopped, with its report, letting its subagent go',
    (await readRun(queued.runId))?.status === ConversationRunStatus.STOPPED
      && ended?.activeRunId === null
      && ended.report === note.report
      && ended.reportedAt !== null,
  )

  const fromStopped = await launch(parent)

  await updateRun(parent.runId, 'stopRequestedAt_expr: "request.time"')

  check(
    'a stop from a run asked to stop is refused',
    await isRefused(
      requestSubagentRunStopForAgent(dataConnect, stopVariables(parent, fromStopped)),
      'The run stopping the subagent has ended or was asked to stop',
    ),
  )
}

try {
  await setUp()
  await checkLauncher()
  await settleRuns()
  await checkLaunching()
  await settleRuns()
  await checkCounting()
  await settleRuns()
  await checkReading()
  await settleRuns()
  await checkStopping()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')
