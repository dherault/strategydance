import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  CompanyAspect,
  ConversationActor,
  ConversationNoteKind,
  ConversationRunStatus,
  type LaunchSubagentVariables,
  chainSubagentRun,
  claimDeletedConversations,
  claimQueuedConversationRun,
  connectorConfig,
  drawSubagentAgentText,
  finishConversationRun,
  finishConversationRunFull,
  finishSubagentRun,
  finishSubagentRunWithNote,
  getClaimedConversations,
  getClaimedSubagents,
  getConversationRequestContext,
  getConversationRunContext,
  getConversationSearchCorpus,
  getConversationSendContext,
  getConversationsWithSubagents,
  getDueSubagentReactions,
  getSubagentPendingRuns,
  getSubagentReactionContext,
  getSubagentSlots,
  getSubagentSweepMembers,
  getSubagentSweepOrganizations,
  getSubagentsToStop,
  interruptDeadConversationRun,
  interruptDeadSubagentRun,
  interruptPendingSubagentRun,
  interruptSubagentRun,
  launchPendingSubagent,
  launchSubagent,
  launchSubagentForAgent,
  markSubagentReportsDelivered,
  promoteSubagentRun,
  pruneClaimedSubagents,
  requestConversationRunStop,
  requestConversationRunStopWithSubagents,
  requestConversationSubagentsStop,
  reserveConversationAttachment,
  retryConversationRun,
  searchConversationMessages,
  searchConversationTitles,
  searchConversationsBySubstring,
  sendConversationMessage,
  startConversation,
  startSubagentReaction,
  stopPendingSubagentRun,
  stopQueuedConversationRun,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the subagents' operations against the emulators, where CI cannot, since what they guard is
  in their SQL conditions:

    bun run check:subagent-runs

  It makes a throwaway organization with two members, starts a conversation, launches subagents of
  it through the backend connector's own operations, as `launchSubagent` calls them, into the
  author's five slots or waiting for one, and ends their runs as a worker does, chains them at their
  limits and promotes those waiting into slots freed, then checks that every read and count of a
  member's conversations leaves them out, that every way a member acts on a conversation refuses one, and that the reads of one
  conversation by its id still read one, the web connector's run as its member through the Admin
  SDK's impersonation. It removes everything it made, then exits non-zero naming each check that
  failed. The domain's tests run against a fake of these operations: this is what says the fake's
  conditions are the SQL's.

  Like `checkConversationRuns.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:subagent-runs`',
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
  author: `check-subagent-runs-${checkId}-author`,
  other: `check-subagent-runs-${checkId}-other`,
}

// A word nothing else in the emulator holds, which the searches look for
const MARK = `zq${checkId}`

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

// A web connector's operation run as the account given, as its token would
function asMember(userId: string) {
  const options = { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } }

  return {
    read: async <Data>(name: string, variables: Variables) =>
      (await webConnector.executeQuery<Data, Variables>(name, variables, options)).data,
    run: (name: string, variables: Variables) => webConnector.executeMutation(name, variables, options),
  }
}

type StoredConversation = {
  parentId: string | null
  activeRunId: string | null
  nextMessagePosition: number
  unreadCount: number
  deletedAt: string | null
  subagentCount: number
  report: string | null
  reportedAt: string | null
  launchAnchorPosition: number | null
}

async function readConversation(id: string) {
  const data = await read<{ conversation: StoredConversation | null }>(
    `query ReadConversation($id: UUID!) {
      conversation(id: $id) {
        parentId activeRunId nextMessagePosition unreadCount deletedAt subagentCount report reportedAt launchAnchorPosition
      }
    }`,
    { id },
  )

  return data.conversation
}

type StoredRun = {
  status: string
  trigger: string
  number: number
  anchorPosition: number
  stopRequestedAt: string | null
  leaseExpiresAt: string | null
  createdAt: string
  pendingToolResults: string | null
  failure: string | null
}

async function readRun(id: string) {
  const data = await read<{ conversationRun: StoredRun | null }>(
    `query ReadRun($id: UUID!) {
      conversationRun(id: $id) {
        status trigger number anchorPosition stopRequestedAt leaseExpiresAt createdAt pendingToolResults failure
      }
    }`,
    { id },
  )

  return data.conversationRun
}

// Writes a run's columns as a test needs them, which no operation writes so
async function updateRun(id: string, data: string) {
  await write(`mutation UpdateRun($id: UUID!) { conversationRun_update(id: $id, data: { ${data} }) }`, { id })
}

// The author's subagent runs holding a slot, and those waiting for one
async function readSlots() {
  const { data } = await getSubagentSlots(dataConnect, { organizationId, userId: userIds.author })

  return data
}

/*
  Ends every subagent run of the author's that holds a slot or waits for one, which no check after
  reads, so a section launches into free slots whatever the ones before it left going
*/
async function settleSubagentRuns() {
  await write(
    `mutation Settle($organizationId: UUID!, $userId: String!) {
      conversationRun_updateMany(
        where: {
          status: { in: [QUEUED, RUNNING, PENDING] }
          conversation: { userId: { eq: $userId }, organizationId: { eq: $organizationId }, parentId: { isNull: false } }
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

type Parent = { conversationId: string; messageId: string; runId: string; membershipCreatedAt: string }

// Starts a conversation of the author's, tagged, and ends its run, as a parent is between messages,
// unless it is asked to leave the run queued
async function startParent({ isIdle = true } = {}): Promise<Parent> {
  const membershipCreatedAt = await readMembershipCreatedAt(userIds.author)
  const parent = { conversationId: createId(), messageId: createId(), runId: createId(), membershipCreatedAt }
  const fence = { organizationId, userId: userIds.author, conversationId: parent.conversationId, runId: parent.runId }

  await startConversation(dataConnect, {
    ...fence,
    membershipCreatedAt,
    messageId: parent.messageId,
    title: 'Checked parent',
    text: 'Checked message',
    preview: { kind: 'MEMBER_TEXT', text: 'Checked message' },
    content: JSON.stringify([{ type: 'text', text: 'Checked message' }]),
    aspects: [CompanyAspect.FINANCES],
    aspectsSetBy: ConversationActor.MEMBER,
    // The checks start more than the daily caps let a member start, which their own checks hold
    isUsageCapped: false,
  })

  if (!isIdle) return parent

  await claimQueuedConversationRun(dataConnect, { ...fence, attempts: 0, membershipCreatedAt })
  await finishConversationRun(dataConnect, {
    ...fence,
    attempts: 1,
    membershipCreatedAt,
    status: ConversationRunStatus.COMPLETED,
  })

  return parent
}

type Subagent = { conversationId: string; runId: string; messageId: string }

// The variables `LaunchSubagent` takes, for a subagent of the parent on its first anchor
function launchVariables(parent: Parent, overrides: Partial<LaunchSubagentVariables> = {}) {
  const subagent: Subagent = { conversationId: createId(), runId: createId(), messageId: createId() }

  return {
    subagent,
    variables: {
      organizationId,
      userId: userIds.author,
      membershipCreatedAt: parent.membershipCreatedAt,
      parentId: parent.conversationId,
      anchorPosition: 0,
      launchRunId: null,
      launchToolUseId: null,
      ...subagent,
      title: `Research ${MARK}`,
      text: 'Compare the pricing pages',
      content: JSON.stringify([{ type: 'text', text: 'Compare the pricing pages' }]),
      attachmentIds: [],
      isUsageCapped: false,
      ...overrides,
    } satisfies LaunchSubagentVariables,
  }
}

// Launches a subagent as `launchSubagent` does, its run queued into a free slot, or waiting for one
// once the author's five are taken
async function launch(parent: Parent, overrides: Partial<LaunchSubagentVariables> = {}) {
  const { subagent, variables } = launchVariables(parent, overrides)
  const { activeRuns } = await readSlots()

  await (activeRuns.length >= 5 ? launchPendingSubagent : launchSubagent)(dataConnect, variables)

  return subagent
}

function subagentFence(parent: Parent, subagent: Subagent, attempts: number) {
  return {
    organizationId,
    userId: userIds.author,
    conversationId: subagent.conversationId,
    runId: subagent.runId,
    attempts,
    membershipCreatedAt: parent.membershipCreatedAt,
  }
}

// Inserts a file of a conversation's, as an upload stores one, sent by a message or waiting in a draft
async function insertFile(conversationId: string, messageId: string | null, userId = userIds.author) {
  const id = createId()

  await write(
    `mutation InsertFile(
      $id: UUID!
      $userId: String!
      $organizationId: UUID!
      $conversationId: UUID!
      $messageId: UUID
      $claudeFileId: String!
    ) {
      conversationAttachment_insert(data: {
        id: $id, userId: $userId, organizationId: $organizationId, conversationId: $conversationId,
        messageId: $messageId, status: READY, name: "pricing.pdf", contentType: "application/pdf",
        size: 2000, pageCount: 1, tokenCount: 1594, claudeFileId: $claudeFileId
      })
    }`,
    { id, userId, organizationId, conversationId, messageId, claudeFileId: `file_${id}` },
  )

  return id
}

async function checkLaunching() {
  const parent = await startParent()
  const subagent = await launch(parent)
  const stored = await readConversation(subagent.conversationId)

  check(
    'a launch makes a subagent of its parent, on its anchor, its run queued and active',
    stored?.parentId === parent.conversationId
      && stored.launchAnchorPosition === 0
      && stored.activeRunId === subagent.runId
      && (await readRun(subagent.runId))?.status === ConversationRunStatus.QUEUED
      && (await readRun(subagent.runId))?.trigger === 'LAUNCH',
  )
  check(
    'a launch moves its parent’s subagent count on',
    (await readConversation(parent.conversationId))?.subagentCount === 1,
  )

  const brief = await read<{ conversationMessages: { kind: string; attachmentIds: string[] | null }[] }>(
    `query ReadBrief($id: UUID!) { conversationMessages(where: { conversationId: { eq: $id } }) { kind attachmentIds } }`,
    { id: subagent.conversationId },
  )

  check('a launch draws its brief as the subagent’s first message', brief.conversationMessages[0]?.kind === 'BRIEF')

  const { variables: again } = launchVariables(parent, { conversationId: subagent.conversationId })

  // Postgres reports the subagent's key, which the insert after the check violates, before the
  // check itself: either way the launch is refused whole, and the backend reads its subagent
  check(
    'a launch sent again finds its subagent made, and changes nothing',
    (await refusal(launchSubagent(dataConnect, again))) !== null
      && (await readConversation(parent.conversationId))?.subagentCount === 1,
  )
  check(
    'a launch of a subagent of a subagent is refused',
    await isRefused(
      launchSubagent(dataConnect, launchVariables(parent, { parentId: subagent.conversationId }).variables),
      'The parent launches no more subagents',
    ),
  )

  const otherCreatedAt = await readMembershipCreatedAt(userIds.other)

  check(
    'a launch on another member’s conversation is refused',
    await isRefused(
      launchSubagent(
        dataConnect,
        launchVariables(parent, { userId: userIds.other, membershipCreatedAt: otherCreatedAt }).variables,
      ),
      'The parent launches no more subagents',
    ),
  )
  check(
    'a launch under a membership that changed since its read is refused',
    await isRefused(
      launchSubagent(dataConnect, launchVariables(parent, { membershipCreatedAt: new Date().toISOString() }).variables),
      'The membership changed since the launch read it',
    ),
  )

  // Files: only those the parent sent
  const sent = await insertFile(parent.conversationId, parent.messageId)
  const waiting = await insertFile(parent.conversationId, null)
  const other = await startParent()
  const elsewhere = await insertFile(other.conversationId, other.messageId)

  for (const [name, id] of [
    ['waiting in a draft', waiting],
    ['another conversation sent', elsewhere],
  ] as const) {
    check(
      `a launch handed a file ${name} is refused`,
      await isRefused(launch(parent, { attachmentIds: [id] }), 'A subagent is handed only files its parent sent'),
    )
  }

  const handed = await launch(parent, { attachmentIds: [sent] })
  const handedBrief = await read<{ conversationMessages: { attachmentIds: string[] | null }[] }>(
    `query ReadBrief($id: UUID!) { conversationMessages(where: { conversationId: { eq: $id } }) { attachmentIds } }`,
    { id: handed.conversationId },
  )

  check(
    'a launch hands over a file its parent sent, kept on its brief',
    handedBrief.conversationMessages[0]?.attachmentIds?.[0] === sent,
  )

  // The ten on one anchor, the deleted left out
  const anchored = []

  for (let index = 0; index < 8; index++) anchored.push(await launch(parent))

  check(
    'an eleventh launch on one anchor is refused',
    await isRefused(launch(parent), 'A parent launches at most 10 subagents on one anchor'),
  )
  check(
    'a launch on another anchor is not counted with them',
    (await refusal(launch(parent, { anchorPosition: 2 }))) === null,
  )

  await write(
    `mutation Delete($id: UUID!) { conversation_update(id: $id, data: { deletedAt_expr: "request.time" }) }`,
    {
      id: anchored[0]?.conversationId,
    },
  )

  check(
    'a subagent deleted, as a retry deletes one, frees its place on the anchor',
    (await refusal(launch(parent))) === null,
  )

  await write(`mutation Hundred($id: UUID!) { conversation_update(id: $id, data: { subagentCount: 100 }) }`, {
    id: parent.conversationId,
  })

  check(
    'a launch on a parent holding 100 is refused',
    await isRefused(launch(parent, { anchorPosition: 4 }), 'The parent launches no more subagents'),
  )

  await write(
    `mutation Deleted($id: UUID!) { conversation_update(id: $id, data: { subagentCount: 0, deletedAt_expr: "request.time" }) }`,
    { id: parent.conversationId },
  )

  check(
    'a launch on a deleted parent is refused',
    await isRefused(launch(parent, { anchorPosition: 4 }), 'The parent launches no more subagents'),
  )
}

async function checkEnding() {
  const parent = await startParent()
  const completed = await launch(parent)
  const fence = subagentFence(parent, completed, 1)

  await claimQueuedConversationRun(dataConnect, { ...fence, attempts: 0 })
  await write(
    `mutation Entry($id: UUID!, $conversationId: UUID!, $runId: UUID!) {
      conversationTranscriptEntry_insert(data: {
        id: $id, conversationId: $conversationId, runId: $runId, position: 1, role: ASSISTANT,
        content: "[{\\"type\\":\\"text\\",\\"text\\":\\"Done\\"}]"
      })
    }`,
    { id: createId(), conversationId: completed.conversationId, runId: completed.runId },
  )

  const entries = await read<{ conversationTranscriptEntries: { id: string }[] }>(
    `query Entries($id: UUID!) { conversationTranscriptEntries(where: { conversationId: { eq: $id }, position: { eq: 1 } }) { id } }`,
    { id: completed.conversationId },
  )

  await drawSubagentAgentText(dataConnect, {
    ...fence,
    entryId: entries.conversationTranscriptEntries[0]?.id ?? '',
    fromBlock: 0,
    toBlock: 1,
    messageId: createId(),
    position: 1,
    text: `Done ${MARK}`,
    preview: { kind: 'AGENT_TEXT', text: 'Done' },
  })

  check(
    'a subagent’s reply adds nothing to its unread count',
    (await readConversation(completed.conversationId))?.unreadCount === 0,
  )
  check(
    'a conversation’s ending refuses a subagent’s run',
    await isRefused(
      finishConversationRun(dataConnect, { ...fence, status: ConversationRunStatus.COMPLETED }),
      "The run is no longer this worker's",
    ),
  )
  check(
    'a report past 8000 characters is refused',
    await isRefused(
      finishSubagentRun(dataConnect, { ...fence, status: ConversationRunStatus.COMPLETED, report: 'a'.repeat(8001) }),
      "A subagent's report holds at most 8000 characters",
    ),
  )

  await finishSubagentRun(dataConnect, { ...fence, status: ConversationRunStatus.COMPLETED, report: 'Done' })

  const reported = await readConversation(completed.conversationId)

  check(
    'a subagent’s ending writes its report and lets go of its run',
    reported?.report === 'Done' && reported.reportedAt !== null && reported.activeRunId === null,
  )

  const failed = await launch(parent)
  const failedFence = subagentFence(parent, failed, 1)

  await claimQueuedConversationRun(dataConnect, { ...failedFence, attempts: 0 })
  await finishSubagentRunWithNote(dataConnect, {
    ...failedFence,
    status: ConversationRunStatus.FAILED,
    noteKind: ConversationNoteKind.FAILED,
    noteId: createId(),
    position: 1,
    preview: { kind: 'NOTE', noteKind: 'FAILED' },
    failure: 'Checked',
    report: 'This subagent failed before it finished.',
  })

  check(
    'a subagent’s noted ending writes its report beside its note',
    (await readConversation(failed.conversationId))?.report === 'This subagent failed before it finished.'
      && (await readRun(failed.runId))?.status === ConversationRunStatus.FAILED,
  )

  const interrupted = await launch(parent)

  await interruptSubagentRun(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: interrupted.conversationId,
    runId: interrupted.runId,
    attempts: 0,
    noteId: createId(),
    position: 1,
    preview: { kind: 'NOTE', noteKind: 'INTERRUPTED' },
    failure: 'Checked',
    report: 'This subagent was interrupted before it finished.',
  })

  check(
    'a subagent’s interruption writes its report',
    (await readConversation(interrupted.conversationId))?.report
      === 'This subagent was interrupted before it finished.',
  )

  // A subagent's ending refuses a conversation's run, queued as a subagent's would be
  const conversation = await startParent({ isIdle: false })

  check(
    'a subagent’s interruption refuses a conversation’s run',
    await isRefused(
      interruptSubagentRun(dataConnect, {
        organizationId,
        userId: userIds.author,
        conversationId: conversation.conversationId,
        runId: conversation.runId,
        attempts: 0,
        noteId: createId(),
        position: 1,
        preview: { kind: 'NOTE', noteKind: 'INTERRUPTED' },
        report: 'x',
      }),
      "The run is no longer this worker's",
    ),
  )

  return { parent, completed, failed }
}

async function checkReading({ parent, completed }: { parent: Parent; completed: Subagent }) {
  const author = asMember(userIds.author)
  const other = asMember(userIds.other)
  const variables = { organizationId, id: completed.conversationId }
  type Tail = { conversations: { id: string; conversationMessages_on_conversation: { id: string; kind: string }[] }[] }
  const tail = await author.read<Tail>('GetConversation', variables)
  const messageIds = tail.conversations[0]?.conversationMessages_on_conversation.map(({ id }) => id) ?? []

  check('the thread’s tail reads a subagent by its id', tail.conversations.length === 1 && messageIds.length === 2)

  const bodies = await author.read<{ conversationMessages: { id: string; text: string | null }[] }>(
    'GetConversationMessageBodies',
    { ...variables, messageIds },
  )

  check(
    'the bodies read a subagent’s messages',
    bodies.conversationMessages.some(({ text }) => text?.includes(MARK)),
  )

  const history = await author.read<{ conversationMessages: { id: string }[] }>('GetConversationMessagesBefore', {
    ...variables,
    beforePosition: 1000,
  })

  check('the history reads a subagent’s messages', history.conversationMessages.length === 2)

  const run = await author.read<{ conversationRuns: { id: string }[] }>('GetConversationRun', {
    organizationId,
    conversationId: completed.conversationId,
  })

  check('the latest run of a subagent reads by its id', run.conversationRuns[0]?.id === completed.runId)

  const othersTail = await other.read<Tail>('GetConversation', variables)
  const othersBodies = await other.read<{ conversationMessages: unknown[] }>('GetConversationMessageBodies', {
    ...variables,
    messageIds,
  })
  const othersHistory = await other.read<{ conversationMessages: unknown[] }>('GetConversationMessagesBefore', {
    ...variables,
    beforePosition: 1000,
  })
  const othersRun = await other.read<{ conversationRuns: unknown[] }>('GetConversationRun', {
    organizationId,
    conversationId: completed.conversationId,
  })

  check(
    'another member reads nothing of a subagent by its id',
    othersTail.conversations.length === 0
      && othersBodies.conversationMessages.length === 0
      && othersHistory.conversationMessages.length === 0
      && othersRun.conversationRuns.length === 0,
  )

  // The lists leave it out, the badge's included once it waits, and the dock's when its id is asked
  await write(`mutation Waits($id: UUID!) { conversation_update(id: $id, data: { isAwaitingAnswer: true }) }`, {
    id: completed.conversationId,
  })

  const list = await author.read<{ conversations: { id: string }[] }>('GetConversations', { organizationId })
  const badge = await author.read<{ conversations: { id: string }[] }>('GetConversationsAwaitingAnswer', {
    organizationId,
  })
  const dock = await author.read<{ conversations: { id: string }[] }>('GetDockConversations', {
    organizationId,
    ids: [parent.conversationId, completed.conversationId],
  })
  const listed = (data: { conversations: { id: string }[] }) => data.conversations.map(({ id }) => id)

  check(
    'the list leaves subagents out, its parents in',
    !listed(list).includes(completed.conversationId) && listed(list).includes(parent.conversationId),
  )
  check('the badge leaves a subagent out', !listed(badge).includes(completed.conversationId))
  check(
    'the dock leaves a subagent out',
    !listed(dock).includes(completed.conversationId) && listed(dock).includes(parent.conversationId),
  )
}

/*
  What the parent's page reads of its subagents through the web connector, as its member: its own
  subagents alone, with the call that launched each and its latest run, a subagent's report, which
  conversation a subagent's is, the call's id and a brief's files with the bodies, and a brief's files
  among the parent's sent ones, never one waiting in a draft or anybody else's
*/
async function checkPageReads() {
  const author = asMember(userIds.author)
  const other = asMember(userIds.other)
  const parent = await startParent()
  const sent = await insertFile(parent.conversationId, parent.messageId)
  const draft = await insertFile(parent.conversationId, null)
  const othersFile = await insertFile(parent.conversationId, parent.messageId, userIds.other)
  const handed = await launch(parent, { launchToolUseId: `toolu_${checkId}`, attachmentIds: [sent] })
  const reported = await launch(parent)
  const deleted = await launch(parent)
  const elsewhere = await launch(await startParent())

  await write(
    `mutation Delete($id: UUID!) { conversation_update(id: $id, data: { deletedAt_expr: "request.time" }) }`,
    {
      id: deleted.conversationId,
    },
  )

  const reportedFence = subagentFence(parent, reported, 1)

  await claimQueuedConversationRun(dataConnect, { ...reportedFence, attempts: 0 })
  await finishSubagentRun(dataConnect, {
    ...reportedFence,
    status: ConversationRunStatus.COMPLETED,
    report: `Reported ${MARK}`,
  })

  type Subagents = {
    conversations: {
      id: string
      launchToolUseId: string | null
      launchAnchorPosition: number | null
      activeRunId: string | null
      reportedAt: string | null
      reportDeliveredAt: string | null
      latestRuns: { id: string; status: string; trigger: string }[]
    }[]
  }
  const listVariables = { organizationId, conversationId: parent.conversationId }
  const { conversations: subagents } = await author.read<Subagents>('GetConversationSubagents', listVariables)
  const [first, second] = subagents

  check(
    'the page reads its own subagents alone, oldest first, never a deleted one or another parent’s',
    subagents.map(({ id }) => id).join() === [handed.conversationId, reported.conversationId].join(),
  )
  check(
    'a listed subagent carries the call that launched it, its anchor, and its run going',
    first?.launchToolUseId === `toolu_${checkId}`
      && first.launchAnchorPosition === 0
      && first.activeRunId === handed.runId
      && first.latestRuns[0]?.id === handed.runId
      && first.latestRuns[0].status === ConversationRunStatus.QUEUED
      && first.latestRuns[0].trigger === 'LAUNCH'
      && first.reportedAt === null,
  )
  check(
    'a listed subagent that reported carries its ended run, its report written and not delivered',
    second?.activeRunId === null
      && second.latestRuns[0]?.status === ConversationRunStatus.COMPLETED
      && second.reportedAt !== null
      && second.reportDeliveredAt === null,
  )
  check(
    'another member reads none of a conversation’s subagents',
    (await other.read<Subagents>('GetConversationSubagents', listVariables)).conversations.length === 0,
  )

  type Report = { conversations: { id: string; report: string | null }[] }
  const report = await author.read<Report>('GetConversationSubagentReport', {
    ...listVariables,
    subagentId: reported.conversationId,
  })

  check('the page reads a subagent’s report through its parent', report.conversations[0]?.report === `Reported ${MARK}`)
  check(
    'a report reads nothing through another conversation, nor for another member',
    (
      await author.read<Report>('GetConversationSubagentReport', {
        organizationId,
        conversationId: elsewhere.conversationId,
        subagentId: reported.conversationId,
      })
    ).conversations.length === 0
      && (
        await other.read<Report>('GetConversationSubagentReport', {
          ...listVariables,
          subagentId: reported.conversationId,
        })
      ).conversations.length === 0,
  )

  type Tail = {
    conversations: {
      parentId: string | null
      subagentCount: number
      conversationMessages_on_conversation: { id: string; kind: string }[]
    }[]
  }
  const parentTail = await author.read<Tail>('GetConversation', { organizationId, id: parent.conversationId })
  const subagentTail = await author.read<Tail>('GetConversation', { organizationId, id: handed.conversationId })

  check(
    'the tail reads a subagent’s parent, and how many subagents a conversation holds, a deleted one included',
    subagentTail.conversations[0]?.parentId === parent.conversationId
      && parentTail.conversations[0]?.parentId === null
      && parentTail.conversations[0].subagentCount === 3,
  )

  const briefId =
    subagentTail.conversations[0]?.conversationMessages_on_conversation.find(({ kind }) => kind === 'BRIEF')?.id ?? ''
  const callId = createId()

  await write(
    `mutation InsertCall($id: UUID!, $conversationId: UUID!, $toolUseId: String!) {
      conversationMessage_insert(data: {
        id: $id, conversationId: $conversationId, kind: TOOL_CALL, position: 500, toolUseId: $toolUseId,
        toolName: "launch_subagent", toolStatus: SUCCEEDED
      })
    }`,
    { id: callId, conversationId: parent.conversationId, toolUseId: `toolu_${checkId}` },
  )

  type Bodies = { conversationMessages: { id: string; toolUseId: string | null; attachmentIds: string[] | null }[] }
  const briefBodies = await author.read<Bodies>('GetConversationMessageBodies', {
    organizationId,
    id: handed.conversationId,
    messageIds: [briefId],
  })
  const callBodies = await author.read<Bodies>('GetConversationMessageBodies', {
    organizationId,
    id: parent.conversationId,
    messageIds: [callId],
  })
  const briefHistory = await author.read<Bodies>('GetConversationMessagesBefore', {
    organizationId,
    id: handed.conversationId,
    beforePosition: 1000,
  })
  const callHistory = await author.read<Bodies>('GetConversationMessagesBefore', {
    organizationId,
    id: parent.conversationId,
    beforePosition: 1000,
  })

  check(
    'the bodies and the history read a brief’s files and a call’s id',
    briefBodies.conversationMessages[0]?.attachmentIds?.join() === sent
      && callBodies.conversationMessages[0]?.toolUseId === `toolu_${checkId}`
      && briefHistory.conversationMessages.find(({ id }) => id === briefId)?.attachmentIds?.join() === sent
      && callHistory.conversationMessages.find(({ id }) => id === callId)?.toolUseId === `toolu_${checkId}`,
  )

  type Files = { conversationAttachments: { id: string; name: string }[] }
  const files = await author.read<Files>('GetConversationBriefAttachments', {
    ...listVariables,
    ids: [sent, draft, othersFile],
  })

  check(
    'a brief’s files are read among its parent’s sent ones, never one waiting in a draft or another member’s',
    files.conversationAttachments.map(({ id }) => id).join() === sent,
  )
  check(
    'a brief’s files read nothing under another conversation',
    (
      await author.read<Files>('GetConversationBriefAttachments', {
        organizationId,
        conversationId: elsewhere.conversationId,
        ids: [sent],
      })
    ).conversationAttachments.length === 0,
  )

  const run = await author.read<{ conversationRuns: { anchorPosition: number }[] }>('GetConversationRun', {
    organizationId,
    conversationId: parent.conversationId,
  })

  check('the latest run reads its anchor', run.conversationRuns[0]?.anchorPosition === 0)
}

async function checkMemberActions() {
  const parent = await startParent()
  const subagent = await launch(parent)
  const author = asMember(userIds.author)
  const reference = { organizationId, userId: userIds.author, conversationId: subagent.conversationId }

  // The web's: a delete matches nothing of it, neither its row nor its run, queued here
  await author.run('DeleteConversation', { organizationId, userId: userIds.author, id: subagent.conversationId })

  check(
    'deleting a subagent changes nothing, its row nor its run',
    (await readConversation(subagent.conversationId))?.deletedAt === null
      && (await readRun(subagent.runId))?.stopRequestedAt === null,
  )

  const unread = createId()

  await write(
    `mutation Unread($id: UUID!, $previewMessageId: UUID!) {
      conversation_update(id: $id, data: { deletedAt_expr: "request.time", unreadCount: 1, previewMessageId: $previewMessageId })
    }`,
    { id: subagent.conversationId, previewMessageId: unread },
  )

  check(
    'restoring a subagent is refused',
    (await refusal(
      author.run('RestoreConversation', { organizationId, userId: userIds.author, id: subagent.conversationId }),
    )) !== null,
  )

  await write(`mutation Undelete($id: UUID!) { conversation_update(id: $id, data: { deletedAt: null }) }`, {
    id: subagent.conversationId,
  })
  await author.run('MarkConversationRead', {
    organizationId,
    userId: userIds.author,
    id: subagent.conversationId,
    previewMessageId: unread,
  })

  check('marking a subagent read changes nothing', (await readConversation(subagent.conversationId))?.unreadCount === 1)
  check(
    'tagging a subagent’s aspects is refused',
    (await refusal(
      author.run('UpdateConversationAspects', {
        organizationId,
        userId: userIds.author,
        id: subagent.conversationId,
        aspects: ['SALES'],
        position: 1,
      }),
    )) !== null,
  )

  // The backend's, as the routes would call them past their own checks, each with the subagent in
  // the state a conversation's would need to take it
  check(
    'uploading under a subagent’s id is refused',
    await isRefused(
      reserveConversationAttachment(dataConnect, {
        ...reference,
        attachmentId: createId(),
        name: 'plan.pdf',
        contentType: 'application/pdf',
        size: 2000,
      }),
      "The conversation is somebody else's",
    ),
  )
  check(
    'stopping a subagent’s queued run is refused',
    (await refusal(
      stopQueuedConversationRun(dataConnect, {
        ...reference,
        runId: subagent.runId,
        noteId: createId(),
        position: 1,
        preview: { kind: 'NOTE', noteKind: 'STOPPED' },
      }),
    )) !== null,
  )

  await claimQueuedConversationRun(dataConnect, { ...subagentFence(parent, subagent, 0) })

  const { data: stop } = await requestConversationRunStop(dataConnect, { ...reference, runId: subagent.runId })

  check('asking a subagent’s run to stop changes nothing', stop.conversationRun_updateMany === 0)

  await write(
    `mutation Expire($id: UUID!) { conversationRun_update(id: $id, data: { leaseExpiresAt_time: { now: true, sub: { seconds: 1 } } }) }`,
    { id: subagent.runId },
  )

  check(
    'finalizing a subagent’s dead run as a conversation’s is refused',
    (await refusal(
      interruptDeadConversationRun(dataConnect, {
        ...reference,
        runId: subagent.runId,
        noteId: createId(),
        position: 1,
        preview: { kind: 'NOTE', noteKind: 'INTERRUPTED' },
        failure: 'Checked',
      }),
    )) !== null,
  )

  // Its run ended with a note, which leaves it idle, as a send or a retry would take it
  await interruptSubagentRun(dataConnect, {
    ...reference,
    runId: subagent.runId,
    attempts: 1,
    noteId: createId(),
    position: 1,
    preview: { kind: 'NOTE', noteKind: 'INTERRUPTED' },
    report: 'This subagent was interrupted before it finished.',
  })

  check(
    'sending to a subagent is refused',
    await isRefused(
      sendConversationMessage(dataConnect, {
        ...reference,
        membershipCreatedAt: parent.membershipCreatedAt,
        messageId: createId(),
        text: 'Hello',
        preview: { kind: 'MEMBER_TEXT', text: 'Hello' },
        position: 2,
        runId: createId(),
        runNumber: 1,
        content: JSON.stringify([{ type: 'text', text: 'Hello' }]),
        transcriptPosition: 1,
        attachmentIds: [],
      }),
      'The conversation could not take the message',
    ),
  )
  check(
    'retrying a subagent’s run is refused',
    await isRefused(
      retryConversationRun(dataConnect, {
        ...reference,
        membershipCreatedAt: parent.membershipCreatedAt,
        retriedRunId: subagent.runId,
        retriedRunNumber: 0,
        anchorPosition: 0,
        historyRevision: 0,
        deletedCount: 2,
        runId: createId(),
        runNumber: 1,
      }),
      'The conversation could not retry that run',
    ),
  )
}

async function checkCounts() {
  const parent = await startParent()
  const subagents = [await launch(parent), await launch(parent), await launch(parent)]
  const { data } = await getConversationSendContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: createId(),
    messageId: createId(),
  })
  const subagentIds = subagents.map(({ conversationId }) => conversationId)

  check(
    'a send counts no subagent’s run in flight',
    !data.conversationRuns.some(({ conversation }) => subagentIds.includes(conversation.id)),
  )

  // Three subagents' runs are queued, and the member starts a conversation all the same
  check('a start counts no subagent toward its conversations or its runs', (await refusal(startParent())) === null)

  const { data: corpus } = await getConversationSearchCorpus(dataConnect, { organizationId, userId: userIds.author })
  const { data: titles } = await searchConversationTitles(dataConnect, {
    organizationId,
    userId: userIds.author,
    query: MARK,
  })
  const { data: messages } = await searchConversationMessages(dataConnect, {
    organizationId,
    userId: userIds.author,
    query: MARK,
  })
  const pattern = `%${MARK}%`
  const { data: substring } = await searchConversationsBySubstring(dataConnect, {
    organizationId,
    userId: userIds.author,
    recentIds: subagentIds,
    pattern0: pattern,
    pattern1: '%',
    pattern2: '%',
    pattern3: '%',
    pattern4: '%',
    pattern5: '%',
    pattern6: '%',
    pattern7: '%',
  })

  check(
    'the searches leave subagents out, by title, message, corpus or substring',
    !corpus.conversations.some(({ id }) => subagentIds.includes(id))
      && titles.conversations_search.length === 0
      && messages.conversationMessages_search.length === 0
      && substring.conversations.length === 0,
  )
}

async function checkRunContexts({ parent, failed }: { parent: Parent; failed: Subagent }) {
  const { data: run } = await getConversationRunContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: failed.conversationId,
    runId: failed.runId,
  })

  check(
    'a subagent’s run context says it is one, and counts its note, not its brief, among what it drew',
    run.conversation?.parentId === parent.conversationId
      && run.conversationMessages.length === 1
      && run.conversationMessages[0]?.kind === 'NOTE',
  )

  const handedFile = await insertFile(parent.conversationId, parent.messageId)
  const { data: request } = await getConversationRequestContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: failed.conversationId,
  })
  const { data: parentRequest } = await getConversationRequestContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: parent.conversationId,
  })

  check(
    'a subagent’s request context reads its parent’s aspects and sent files',
    request.conversations[0]?.parent?.aspects.includes(CompanyAspect.FINANCES) === true
      && request.parentAttachments.some(({ claudeFileId }) => claudeFileId === `file_${handedFile}`),
  )
  check('a conversation’s request context reads no parent’s files', parentRequest.parentAttachments.length === 0)
}

// The note and report a pending or dead run's ending writes
function endingVariables(subagent: Subagent, noteKind: ConversationNoteKind) {
  return {
    organizationId,
    userId: userIds.author,
    conversationId: subagent.conversationId,
    runId: subagent.runId,
    noteId: createId(),
    preview: { kind: 'NOTE', noteKind },
    failure: 'Checked',
    report: 'Checked report',
  }
}

// An ending's variables for a conversation's operation, which writes no report
function withoutReport<Variables extends { report: string }>({ report: _report, ...variables }: Variables) {
  return variables
}

async function readPosition(subagent: Subagent) {
  return (await readConversation(subagent.conversationId))?.nextMessagePosition ?? 0
}

async function checkSlots() {
  const parent = await startParent()
  const running: Subagent[] = []

  for (let index = 0; index < 5; index++) running.push(await launch(parent))

  check(
    'five launches take the author’s five slots, their runs queued',
    (await readSlots()).activeRuns.length === 5
      && (await Promise.all(running.map(({ runId }) => readRun(runId)))).every(run => run?.status === 'QUEUED'),
  )
  check(
    'a sixth launch into a slot is refused while five go',
    await isRefused(
      launchSubagent(dataConnect, launchVariables(parent).variables),
      "Every one of the member's 5 subagent slots is taken",
    ),
  )

  const { subagent: pending, variables } = launchVariables(parent)

  await launchPendingSubagent(dataConnect, variables)

  const pendingRun = await readRun(pending.runId)

  check(
    'a launch past the slots waits pending, with no lease, its subagent busy',
    pendingRun?.status === 'PENDING'
      && pendingRun.leaseExpiresAt === null
      && pendingRun.trigger === 'LAUNCH'
      && (await readConversation(pending.conversationId))?.activeRunId === pending.runId,
  )
  check(
    'the slots read the five going and the run waiting',
    (await readSlots()).activeRuns.length === 5
      && (await readSlots()).pendingRuns.some(({ id }) => id === pending.runId),
  )

  const promotion = (subagent: Subagent, membershipCreatedAt = parent.membershipCreatedAt) =>
    promoteSubagentRun(dataConnect, {
      organizationId,
      userId: userIds.author,
      membershipCreatedAt,
      conversationId: subagent.conversationId,
      runId: subagent.runId,
    })

  check(
    'a promotion while five go is refused',
    await isRefused(promotion(pending), "Every one of the member's 5 subagent slots is taken"),
  )

  // Launched while the five go, so each waits: those the promotion skips, asked to stop, deleted and
  // launched under a membership since replaced, and one that may be promoted
  const stopped = await launch(parent)
  const deleted = await launch(parent)
  const ofBefore = await launch(parent)
  const waiting = await launch(parent, { anchorPosition: 1 })

  await updateRun(stopped.runId, 'stopRequestedAt_expr: "request.time"')
  await write(
    `mutation Delete($id: UUID!) { conversation_update(id: $id, data: { deletedAt_expr: "request.time" }) }`,
    {
      id: deleted.conversationId,
    },
  )
  await updateRun(ofBefore.runId, 'membershipCreatedAt: "2026-01-01T00:00:00.000000Z"')

  // One ends, and frees a slot
  const [ending] = running

  if (!ending) throw new Error('No subagent launched')

  await claimQueuedConversationRun(dataConnect, { ...subagentFence(parent, ending, 0) })
  await finishSubagentRun(dataConnect, {
    ...subagentFence(parent, ending, 1),
    status: ConversationRunStatus.COMPLETED,
    report: 'Done',
  })

  check(
    'a promotion under a membership since replaced is refused',
    await isRefused(promotion(pending, new Date().toISOString()), 'The membership changed since the promotion read it'),
  )

  const { data: waitingRuns } = await getSubagentPendingRuns(dataConnect, {
    organizationId,
    userId: userIds.author,
    membershipCreatedAt: parent.membershipCreatedAt,
  })
  const promotableIds = waitingRuns.promotableRuns.map(({ id }) => id)
  const skippedIds = waitingRuns.skippedRuns.map(({ id }) => id)

  check(
    'the runs a promotion may promote are read oldest first, and those it skips apart',
    promotableIds.join() === [pending.runId, waiting.runId].join()
      && [stopped, deleted, ofBefore].every(({ runId }) => skippedIds.includes(runId) && !promotableIds.includes(runId))
      && !skippedIds.includes(pending.runId),
  )

  for (const [name, subagent] of [
    ['asked to stop', stopped],
    ['whose subagent is deleted', deleted],
    ['of a membership since replaced', ofBefore],
  ] as const) {
    check(
      `a promotion of a run ${name} is refused`,
      await isRefused(promotion(subagent), 'The run is no longer waiting for a slot'),
    )
  }

  const before = await readRun(pending.runId)

  await promotion(pending)

  const promoted = await readRun(pending.runId)

  check(
    'a promotion queues the run waiting, with a lease, its time queued moved on',
    promoted?.status === 'QUEUED'
      && promoted.leaseExpiresAt !== null
      && Date.parse(promoted.createdAt) > Date.parse(before?.createdAt ?? ''),
  )

  // Another ends, so the slots no longer refuse what follows
  const [, second] = running

  if (!second) throw new Error('No subagent launched')

  await claimQueuedConversationRun(dataConnect, { ...subagentFence(parent, second, 0) })
  await finishSubagentRun(dataConnect, {
    ...subagentFence(parent, second, 1),
    status: ConversationRunStatus.COMPLETED,
    report: 'Done',
  })

  check(
    'a promotion of a run promoted already is refused',
    await isRefused(promotion(pending), 'The run is no longer waiting for a slot'),
  )

  // The pending endings, each only for its own reason
  check(
    'stopping a pending run nobody asked to stop is refused',
    await isRefused(
      stopPendingSubagentRun(dataConnect, {
        ...endingVariables(waiting, ConversationNoteKind.STOPPED),
        position: await readPosition(waiting),
      }),
      'The run no longer waits to be stopped',
    ),
  )
  check(
    'interrupting a pending run of the membership as it is is refused',
    await isRefused(
      interruptPendingSubagentRun(dataConnect, {
        ...endingVariables(waiting, ConversationNoteKind.INTERRUPTED),
        membershipCreatedAt: parent.membershipCreatedAt,
        position: await readPosition(waiting),
      }),
      'The run no longer waits to be interrupted',
    ),
  )

  for (const subagent of [stopped, deleted]) {
    await stopPendingSubagentRun(dataConnect, {
      ...endingVariables(subagent, ConversationNoteKind.STOPPED),
      position: await readPosition(subagent),
    })
  }

  await interruptPendingSubagentRun(dataConnect, {
    ...endingVariables(ofBefore, ConversationNoteKind.INTERRUPTED),
    membershipCreatedAt: '2026-01-01T00:00:00.000000Z',
    position: await readPosition(ofBefore),
  })

  check(
    'a pending run asked to stop, or whose subagent is deleted, ends stopped with its report',
    (await readRun(stopped.runId))?.status === 'STOPPED'
      && (await readRun(deleted.runId))?.status === 'STOPPED'
      && (await readConversation(stopped.conversationId))?.report === 'Checked report'
      && (await readConversation(stopped.conversationId))?.activeRunId === null,
  )
  check(
    'a pending run of a membership since replaced ends interrupted with its report',
    (await readRun(ofBefore.runId))?.status === 'INTERRUPTED'
      && (await readConversation(ofBefore.conversationId))?.report === 'Checked report',
  )

  // A run that died with its worker, past its lease
  const [, , dying, holding] = running

  if (!dying || !holding) throw new Error('No subagent launched')

  await updateRun(dying.runId, 'leaseExpiresAt_expr: "request.time"')

  // The sweep finds the author by their runs waiting and the one past its lease, and nobody else
  const swept = (await getSubagentSweepMembers(dataConnect, { afterUserId: '' })).data.users.map(({ id }) => id)
  const after = (await getSubagentSweepMembers(dataConnect, { afterUserId: userIds.author })).data.users
  const { data: sweptOrganizations } = await getSubagentSweepOrganizations(dataConnect, { userId: userIds.author })

  check(
    'the sweep finds the member with subagent runs to reconcile, by account and organization',
    swept.includes(userIds.author)
      && !swept.includes(userIds.other)
      && !after.some(({ id }) => id === userIds.author)
      && sweptOrganizations.organizations.some(({ id }) => id === organizationId),
  )

  check(
    'a subagent run whose lease holds is not interrupted as dead',
    await isRefused(
      interruptDeadSubagentRun(dataConnect, {
        ...endingVariables(holding, ConversationNoteKind.INTERRUPTED),
        position: await readPosition(holding),
      }),
      'The run is not dead',
    ),
  )
  check(
    'a conversation’s dead run interrupt refuses a subagent’s run',
    await isRefused(
      interruptDeadConversationRun(dataConnect, {
        ...withoutReport(endingVariables(dying, ConversationNoteKind.INTERRUPTED)),
        position: await readPosition(dying),
      }),
      'The run is not dead',
    ),
  )

  await interruptDeadSubagentRun(dataConnect, {
    ...endingVariables(dying, ConversationNoteKind.INTERRUPTED),
    position: await readPosition(dying),
  })

  check(
    'a subagent run that died with its worker ends interrupted, with its report and its note',
    (await readRun(dying.runId))?.status === 'INTERRUPTED'
      && (await readConversation(dying.conversationId))?.report === 'Checked report'
      && (await readConversation(dying.conversationId))?.nextMessagePosition === 2,
  )

  // The web's run, read by its member, for a subagent waiting for a slot
  const author = asMember(userIds.author)
  const webRun = await author.read<{ conversationRuns: { status: string }[] }>('GetConversationRun', {
    organizationId,
    conversationId: waiting.conversationId,
  })

  check('the web reads a subagent’s run waiting for a slot', webRun.conversationRuns[0]?.status === 'PENDING')
}

async function checkChain() {
  const parent = await startParent()
  const subagent = await launch(parent)
  const next = { conversationId: subagent.conversationId, runId: createId() }

  await claimQueuedConversationRun(dataConnect, { ...subagentFence(parent, subagent, 0) })

  const chain = (overrides: Record<string, unknown> = {}) =>
    chainSubagentRun(dataConnect, {
      ...subagentFence(parent, subagent, 1),
      runNumber: 0,
      anchorPosition: 0,
      nextRunId: next.runId,
      nextRunNumber: 1,
      failure: 'The run sent its 25 requests',
      pendingToolResults: '[{"type":"tool_result","tool_use_id":"toolu_checked","content":"null"}]',
      ...overrides,
    })

  check(
    'a chain at another attempt is refused',
    await isRefused(chain({ attempts: 2 }), "The run is no longer this worker's"),
  )
  check(
    'a chain at another anchor or number is refused',
    (await isRefused(chain({ anchorPosition: 3 }), "The run is no longer this worker's"))
      && (await isRefused(chain({ runNumber: 1, nextRunNumber: 2 }), "The run is no longer this worker's")),
  )

  await updateRun(subagent.runId, 'stopRequestedAt_expr: "request.time"')

  check('a chain of a run asked to stop is refused', await isRefused(chain(), "The run is no longer this worker's"))

  await updateRun(subagent.runId, 'stopRequestedAt: null, number: 3')

  check(
    'a fourth run’s chain is refused',
    await isRefused(chain({ runNumber: 3, nextRunNumber: 4 }), "A subagent's run chains to the run right after it"),
  )

  await updateRun(subagent.runId, 'number: 0')
  await chain()

  const chained = await readRun(subagent.runId)
  const continued = await readRun(next.runId)
  const stored = await readConversation(subagent.conversationId)

  check(
    'a chain ends the run chained, with no lease',
    chained?.status === 'CHAINED'
      && chained.leaseExpiresAt === null
      && chained.failure === 'The run sent its 25 requests',
  )
  check(
    'a chain queues the next run on the same anchor, its results carried, holding the subagent',
    continued?.trigger === 'CONTINUE'
      && continued.status === 'QUEUED'
      && continued.number === 1
      && continued.anchorPosition === 0
      && continued.leaseExpiresAt !== null
      && continued.pendingToolResults?.includes('toolu_checked') === true
      && stored?.activeRunId === next.runId,
  )
  // Postgres reports the next run's number, which the insert after the fence violates, before the
  // fence's own check: either way the chain is refused whole
  check(
    'a chain is not written twice',
    (await refusal(chain({ nextRunId: createId() }))) !== null
      && (await readConversation(subagent.conversationId))?.activeRunId === next.runId,
  )

  const author = asMember(userIds.author)
  const webRun = await author.read<{ conversationRuns: { id: string }[] }>('GetConversationRun', {
    organizationId,
    conversationId: subagent.conversationId,
  })

  check('the web reads the run a chain queued as the subagent’s latest', webRun.conversationRuns[0]?.id === next.runId)
}

// Ends every run of the author's conversations that goes, which no check after reads, so a section
// starts runs whatever the ones before it left going
async function settleConversationRuns() {
  await write(
    `mutation SettleRuns($organizationId: UUID!, $userId: String!) {
      conversationRun_updateMany(
        where: {
          status: { in: [QUEUED, RUNNING] }
          conversation: { userId: { eq: $userId }, organizationId: { eq: $organizationId }, parentId: { isNull: true } }
        }
        data: { status: COMPLETED, leaseExpiresAt: null }
      )
      conversation_updateMany(
        where: { userId: { eq: $userId }, organizationId: { eq: $organizationId }, parentId: { isNull: true } }
        data: { activeRunId: null }
      )
    }`,
    { organizationId, userId: userIds.author },
  )
}

// Ends a subagent's run with its report, as its worker does
async function report(parent: Parent, subagent: Subagent, text = 'Done') {
  await claimQueuedConversationRun(dataConnect, subagentFence(parent, subagent, 0))
  await finishSubagentRun(dataConnect, {
    ...subagentFence(parent, subagent, 1),
    status: ConversationRunStatus.COMPLETED,
    report: text,
  })
}

async function readDeliveredAt(id: string) {
  const data = await read<{ conversation: { reportDeliveredAt: string | null } | null }>(
    `query ReadDelivered($id: UUID!) { conversation(id: $id) { reportDeliveredAt } }`,
    { id },
  )

  return data.conversation?.reportDeliveredAt ?? null
}

async function checkReactions() {
  const parent = await startParent()
  const [first, second] = [await launch(parent), await launch(parent)]

  await report(parent, first)
  await report(parent, second)

  const reaction = {
    organizationId,
    userId: userIds.author,
    conversationId: parent.conversationId,
    membershipCreatedAt: parent.membershipCreatedAt,
    runId: createId(),
    runNumber: 1,
    content: JSON.stringify([{ type: 'text', text: '{"subagentReport":{}}' }]),
    transcriptPosition: 1,
    subagentIds: [first.conversationId, second.conversationId],
  }
  const context = await getSubagentReactionContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: parent.conversationId,
  })

  check(
    'the reaction’s context reads the parent’s latest run, its last entry and its subagents’ reports waiting',
    context.data.latestRuns[0]?.status === ConversationRunStatus.COMPLETED
      && context.data.lastEntries[0]?.position === 0
      && context.data.subagents.filter(({ reportedAt, reportDeliveredAt }) => reportedAt && !reportDeliveredAt).length
        === 2,
  )
  check(
    'the member’s reactions due read the parent, idle with a report waiting',
    (await getDueSubagentReactions(dataConnect, { organizationId, userId: userIds.author })).data.conversations.some(
      ({ id }) => id === parent.conversationId,
    ),
  )
  check(
    'a reaction naming a report that does not wait is refused',
    await isRefused(
      startSubagentReaction(dataConnect, { ...reaction, subagentIds: [first.conversationId, createId()] }),
      'The reports changed since the reaction read them',
    ),
  )
  check(
    'a reaction at a run number something moved on is refused',
    await isRefused(
      startSubagentReaction(dataConnect, { ...reaction, runNumber: 2 }),
      'The conversation could not take the reaction',
    ),
  )

  await startSubagentReaction(dataConnect, reaction)

  const started = await readRun(reaction.runId)

  check(
    'a reaction starts a run triggered REPORTS, queued on its entry, and marks the reports it carries delivered',
    started?.trigger === 'REPORTS'
      && started.status === ConversationRunStatus.QUEUED
      && started.anchorPosition === 1
      && (await readConversation(parent.conversationId))?.activeRunId === reaction.runId
      && (await readDeliveredAt(first.conversationId)) !== null
      && (await readDeliveredAt(second.conversationId)) !== null,
  )
  check(
    'a second reaction, as a second subagent ending at once starts, finds the parent busy',
    await isRefused(
      startSubagentReaction(dataConnect, {
        ...reaction,
        runId: createId(),
        runNumber: 2,
        transcriptPosition: 2,
        subagentIds: [first.conversationId],
      }),
      'The conversation could not take the reaction',
    ),
  )

  await settleConversationRuns()

  // A parent whose latest run stopped reacts to nothing
  const stopped = await startParent()
  const waiting = await launch(stopped)

  await report(stopped, waiting)
  await updateRun(stopped.runId, 'status: STOPPED')

  check(
    'a reaction is refused unless the latest run completed',
    await isRefused(
      startSubagentReaction(dataConnect, {
        ...reaction,
        conversationId: stopped.conversationId,
        runId: createId(),
        subagentIds: [waiting.conversationId],
      }),
      'A conversation reacts only once its latest run completed',
    ),
  )

  // Three runs going, the member's most, hold it back
  const others = [await startParent({ isIdle: false }), await startParent({ isIdle: false })]
  const idle = await startParent()
  const held = await launch(idle)

  await report(idle, held)
  others.push(await startParent({ isIdle: false }))

  check(
    'a reaction is refused while the member has 3 runs in flight',
    await isRefused(
      startSubagentReaction(dataConnect, {
        ...reaction,
        conversationId: idle.conversationId,
        runId: createId(),
        subagentIds: [held.conversationId],
      }),
      'Somebody has at most 3 runs in flight in an organization',
    ),
  )

  await settleConversationRuns()

  // A suspension, the account's or the organization's, leaves the reports waiting
  const suspendedParent = await startParent()
  const suspendedSubagent = await launch(suspendedParent)

  await report(suspendedParent, suspendedSubagent)

  const suspendedReaction = {
    ...reaction,
    conversationId: suspendedParent.conversationId,
    runId: createId(),
    subagentIds: [suspendedSubagent.conversationId],
  }

  await write(
    `mutation SuspendAccount($id: String!) { user_update(key: { id: $id }, data: { conversationsSuspendedAt_expr: "request.time" }) }`,
    { id: userIds.author },
  )

  check(
    'a reaction is refused while the member’s conversations are suspended',
    await isRefused(
      startSubagentReaction(dataConnect, suspendedReaction),
      'Conversations are suspended for this account',
    ),
  )

  await write(
    `mutation SuspendOrganization($id: UUID!, $userId: String!) @transaction {
      organization_update(id: $id, data: { conversationsSuspendedAt_expr: "request.time" })
      user_update(key: { id: $userId }, data: { conversationsSuspendedAt: null })
    }`,
    { id: organizationId, userId: userIds.author },
  )

  check(
    'a reaction is refused while the organization’s conversations are suspended',
    await isRefused(
      startSubagentReaction(dataConnect, suspendedReaction),
      'Conversations are suspended in this organization',
    ),
  )
  check(
    'a suspended reaction delivers none of its reports',
    (await readDeliveredAt(suspendedSubagent.conversationId)) === null,
  )

  await write(
    `mutation LiftOrganization($id: UUID!) { organization_update(id: $id, data: { conversationsSuspendedAt: null }) }`,
    {
      id: organizationId,
    },
  )
  await startSubagentReaction(dataConnect, suspendedReaction)
  await settleConversationRuns()

  // A send names the reports it carries, exactly
  const sent = await startParent()
  const reported = await launch(sent)

  await report(sent, reported)

  const send = {
    organizationId,
    userId: userIds.author,
    conversationId: sent.conversationId,
    membershipCreatedAt: sent.membershipCreatedAt,
    messageId: createId(),
    text: 'And?',
    preview: { kind: 'MEMBER_TEXT', text: 'And?' },
    position: 1,
    runId: createId(),
    runNumber: 1,
    content: JSON.stringify([{ type: 'text', text: 'And?' }]),
    transcriptPosition: 1,
    attachmentIds: [],
  }

  check(
    'a send naming no report, from before M33, is refused while one waits',
    await isRefused(sendConversationMessage(dataConnect, send), 'The reports changed since the backend read them'),
  )
  check(
    'a send naming a report that does not wait is refused',
    await isRefused(
      sendConversationMessage(dataConnect, { ...send, deliveredSubagentIds: [createId()] }),
      'The reports changed since the backend read them',
    ),
  )

  await sendConversationMessage(dataConnect, { ...send, deliveredSubagentIds: [reported.conversationId] })

  check('a send marks the reports it carries delivered', (await readDeliveredAt(reported.conversationId)) !== null)

  await settleConversationRuns()

  // A full ending marks every report waiting delivered, and one after is marked with no run
  const full = await startParent({ isIdle: false })
  const fullFence = {
    organizationId,
    userId: userIds.author,
    conversationId: full.conversationId,
    runId: full.runId,
    membershipCreatedAt: full.membershipCreatedAt,
  }
  const [during, after] = [await launch(full), await launch(full)]

  await report(full, during)
  await claimQueuedConversationRun(dataConnect, { ...fullFence, attempts: 0 })
  await finishConversationRunFull(dataConnect, {
    ...fullFence,
    attempts: 1,
    noteId: createId(),
    position: 1,
    preview: { kind: 'NOTE', noteKind: ConversationNoteKind.FULL },
    failure: 'Full',
  })

  check(
    'a full ending marks the reports waiting delivered, and leaves the conversation with the full note',
    (await readDeliveredAt(during.conversationId)) !== null
      && (await readRun(full.runId))?.status === ConversationRunStatus.FAILED,
  )

  await report(full, after)

  check(
    'marking a full conversation’s reports is refused once it started a run since',
    await isRefused(
      markSubagentReportsDelivered(dataConnect, {
        organizationId,
        userId: userIds.author,
        conversationId: full.conversationId,
        parentRunNumber: -1,
        subagentIds: [after.conversationId],
      }),
      'The conversation started a run since it was full',
    ),
  )

  await markSubagentReportsDelivered(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: full.conversationId,
    parentRunNumber: 0,
    subagentIds: [after.conversationId],
  })

  check(
    'a full conversation’s report is marked delivered with no run',
    (await readDeliveredAt(after.conversationId)) !== null,
  )
}

async function checkCascades() {
  const author = asMember(userIds.author)

  // Stop: the run, its anchor's subagents, and none of an earlier anchor's
  const parent = await startParent()
  const earlier = await launch(parent)

  await updateRun(parent.runId, 'status: RUNNING, stopRequestedAt: null')
  await write(
    `mutation Busy($id: UUID!, $runId: UUID!) { conversation_update(id: $id, data: { activeRunId: $runId }) }`,
    {
      id: parent.conversationId,
      runId: parent.runId,
    },
  )

  const onAnchor = await launch(parent, { anchorPosition: 3 })

  await updateRun(parent.runId, 'anchorPosition: 3')
  await requestConversationRunStopWithSubagents(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: parent.conversationId,
    runId: parent.runId,
    anchorPosition: 3,
  })

  check(
    'a stop asks its run and its anchor’s subagents to stop, and no subagent an earlier message launched',
    (await readRun(parent.runId))?.stopRequestedAt !== null
      && (await readRun(onAnchor.runId))?.stopRequestedAt !== null
      && (await readRun(earlier.runId))?.stopRequestedAt === null,
  )

  const toStop = await getSubagentsToStop(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: parent.conversationId,
    anchorPosition: 3,
  })

  check(
    'the subagents a stop reaches are read with the run each is busy with',
    toStop.data.conversations.length === 1
      && toStop.data.conversations[0]?.latestRuns[0]?.id === onAnchor.runId
      && toStop.data.conversations[0]?.latestRuns[0]?.stopRequestedAt !== null,
  )

  await requestConversationSubagentsStop(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: parent.conversationId,
  })

  check('Stop all asks every live subagent to stop', (await readRun(earlier.runId))?.stopRequestedAt !== null)

  // A launch after the stop is refused, from the run asked to stop
  const { variables } = launchVariables(parent, { anchorPosition: 3, launchRunId: parent.runId })

  check(
    'a launch after its parent’s stop is refused',
    await isRefused(
      launchSubagentForAgent(dataConnect, {
        ...variables,
        launchRunId: parent.runId,
        isKeyed: false,
        idempotencyScope: '',
        idempotencyKey: '',
        tool: 'launch_subagent',
        argumentsHash: '',
        result: '',
      }),
      'The run launching the subagent has ended or was asked to stop',
    ),
  )

  await settleConversationRuns()
  await settleSubagentRuns()

  // The web's delete takes the live subagents at its own instant, and its restore brings back those
  const deleted = await startParent()
  const taken = await launch(deleted)
  const retried = await launch(deleted, { anchorPosition: 1 })

  await write(
    `mutation RetryDeleted($id: UUID!) { conversation_update(id: $id, data: { deletedAt_time: { now: true, sub: { minutes: 5 } } }) }`,
    { id: retried.conversationId },
  )
  await author.run('DeleteConversation', { organizationId, userId: userIds.author, id: deleted.conversationId })

  const deletedParent = await readConversation(deleted.conversationId)
  const deletedTaken = await readConversation(taken.conversationId)

  check(
    'a delete takes its live subagents at its own instant, their runs asked to stop',
    deletedParent?.deletedAt !== null
      && deletedTaken?.deletedAt === deletedParent?.deletedAt
      && (await readRun(taken.runId))?.stopRequestedAt !== null,
  )
  check(
    'a launch on a deleted parent is refused',
    await isRefused(
      launchSubagent(dataConnect, launchVariables(deleted).variables),
      'The parent launches no more subagents',
    ),
  )

  await author.run('RestoreConversation', { organizationId, userId: userIds.author, id: deleted.conversationId })

  check(
    'a restore brings back the subagents its delete took, and none deleted at another instant',
    (await readConversation(deleted.conversationId))?.deletedAt === null
      && (await readConversation(taken.conversationId))?.deletedAt === null
      && (await readConversation(retried.conversationId))?.deletedAt !== null,
  )

  await settleSubagentRuns()

  // The prune: idle subagents only, before their parent, the parent's count lowered
  const pruned = await startParent()
  const [idleSubagent, busySubagent] = [await launch(pruned), await launch(pruned)]

  await report(pruned, idleSubagent)
  await write(
    `mutation Age($ids: [UUID!]!) {
      conversation_updateMany(where: { id: { in: $ids } }, data: { deletedAt_time: { now: true, sub: { days: 2 } } })
    }`,
    { ids: [idleSubagent.conversationId, busySubagent.conversationId] },
  )
  await claimDeletedConversations(dataConnect)

  const claimed = (await getClaimedSubagents(dataConnect)).data.conversations.map(({ id }) => id)

  check(
    'a prune claims a subagent only once no run holds it',
    claimed.includes(idleSubagent.conversationId) && !claimed.includes(busySubagent.conversationId),
  )
  check(
    'the claimed conversations a prune deletes leave the subagents out',
    !(await getClaimedConversations(dataConnect)).data.conversations.some(
      ({ id }) => id === idleSubagent.conversationId,
    ),
  )
  const holding = (
    await getConversationsWithSubagents(dataConnect, { ids: [pruned.conversationId, idleSubagent.conversationId] })
  ).data.conversations.map(({ id }) => id)

  check(
    'a parent still holding a subagent is read as one, and a conversation holding none is not',
    holding.length === 1 && holding[0] === pruned.conversationId,
  )
  check(
    'a prune counting what it does not delete is refused',
    await isRefused(
      pruneClaimedSubagents(dataConnect, {
        parentId: pruned.conversationId,
        ids: [idleSubagent.conversationId, busySubagent.conversationId],
        count: 2,
      }),
      'The subagents changed since the prune read them',
    ),
  )

  const before = (await readConversation(pruned.conversationId))?.subagentCount ?? 0

  await pruneClaimedSubagents(dataConnect, {
    parentId: pruned.conversationId,
    ids: [idleSubagent.conversationId],
    count: 1,
  })

  check(
    'a prune deletes the subagents it names and lowers their parent’s count by as many',
    (await readConversation(idleSubagent.conversationId)) === null
      && (await readConversation(pruned.conversationId))?.subagentCount === before - 1,
  )

  await settleSubagentRuns()
}

/*
  A launch against what else starts or carries a run on its parent, in both orders: a send, an
  answer, Resume and Retry each find the parent busy while the run launching goes, and a launch
  finds its run no longer running once any of them carried the conversation on, so whichever
  commits second sees the first
*/
async function checkLaunchOrders() {
  const parent = await startParent({ isIdle: false })
  const fence = {
    organizationId,
    userId: userIds.author,
    conversationId: parent.conversationId,
    runId: parent.runId,
    membershipCreatedAt: parent.membershipCreatedAt,
  }
  const launchFrom = (runId: string) => {
    const { variables } = launchVariables(parent, { launchRunId: runId })

    return launchSubagentForAgent(dataConnect, {
      ...variables,
      launchRunId: runId,
      isKeyed: false,
      idempotencyScope: '',
      idempotencyKey: '',
      tool: 'launch_subagent',
      argumentsHash: '',
      result: '',
    })
  }
  const send = (runId: string) =>
    sendConversationMessage(dataConnect, {
      organizationId,
      userId: userIds.author,
      conversationId: parent.conversationId,
      membershipCreatedAt: parent.membershipCreatedAt,
      messageId: createId(),
      text: 'And?',
      preview: { kind: 'MEMBER_TEXT', text: 'And?' },
      position: 1,
      runId,
      runNumber: 1,
      content: JSON.stringify([{ type: 'text', text: 'And?' }]),
      transcriptPosition: 1,
      attachmentIds: [],
      deliveredSubagentIds: [],
    })
  const retry = () =>
    retryConversationRun(dataConnect, {
      organizationId,
      userId: userIds.author,
      conversationId: parent.conversationId,
      membershipCreatedAt: parent.membershipCreatedAt,
      retriedRunId: parent.runId,
      retriedRunNumber: 0,
      anchorPosition: 0,
      historyRevision: 0,
      deletedCount: 0,
      runId: createId(),
      runNumber: 1,
    })

  await claimQueuedConversationRun(dataConnect, { ...fence, attempts: 0 })

  // The run launching goes: a launch first, then the rest find the parent busy
  await launchFrom(parent.runId)

  check(
    'a send while the run that launched goes finds the parent busy',
    await isRefused(send(createId()), 'The conversation could not take the message'),
  )
  check(
    'a retry while the run that launched goes is refused',
    await isRefused(retry(), 'Only a run that ended with a note is retried'),
  )

  // The run waits on a question: a launch from it is refused, as an answer's continuation follows
  await updateRun(parent.runId, 'status: WAITING')

  check(
    'a launch from a run waiting on its member is refused',
    await isRefused(launchFrom(parent.runId), 'The run launching the subagent has ended or was asked to stop'),
  )

  // The run failed: a Retry first, then a launch from it is refused, and the Retry took its subagents
  await updateRun(parent.runId, 'status: FAILED')
  await write(`mutation Idle($id: UUID!) { conversation_update(id: $id, data: { activeRunId: null }) }`, {
    id: parent.conversationId,
  })
  await retry()

  check(
    'a launch from a run a retry took over is refused, and the retry deleted what it launched',
    (await isRefused(launchFrom(parent.runId), 'The run launching the subagent has ended or was asked to stop'))
      && (
        await read<{ conversations: { deletedAt: string | null }[] }>(
          `query Launched($parentId: UUID!) { conversations(where: { parentId: { eq: $parentId } }) { deletedAt } }`,
          { parentId: parent.conversationId },
        )
      ).conversations.every(({ deletedAt }) => deletedAt !== null),
  )

  await settleConversationRuns()
  await settleSubagentRuns()

  // A send first: the launch from the run before it is refused
  const sent = await startParent()

  await sendConversationMessage(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: sent.conversationId,
    membershipCreatedAt: sent.membershipCreatedAt,
    messageId: createId(),
    text: 'And?',
    preview: { kind: 'MEMBER_TEXT', text: 'And?' },
    position: 1,
    runId: createId(),
    runNumber: 1,
    content: JSON.stringify([{ type: 'text', text: 'And?' }]),
    transcriptPosition: 1,
    attachmentIds: [],
    deliveredSubagentIds: [],
  })

  const { variables } = launchVariables(sent, { launchRunId: sent.runId })

  check(
    'a launch from the run a send came after is refused',
    await isRefused(
      launchSubagentForAgent(dataConnect, {
        ...variables,
        launchRunId: sent.runId,
        isKeyed: false,
        idempotencyScope: '',
        idempotencyKey: '',
        tool: 'launch_subagent',
        argumentsHash: '',
        result: '',
      }),
      'The run launching the subagent has ended or was asked to stop',
    ),
  )

  await settleConversationRuns()
  await settleSubagentRuns()
}

/*
  The daily cap on launches, the member's 30 in the organization, which every launch's mutation counts
  unless the caps are lifted, as the checks above lift them, and a lift left null holds. The
  account's 60 is counted as `check:conversation-runs` checks the account's runs. Checked last, since
  the starts it inserts count against the author
*/
async function checkDailyLaunches() {
  const parent = await startParent()
  const rows = Array.from({ length: 30 }, () => ({ userId: userIds.author, organizationId, kind: 'SUBAGENT' }))

  // With what the checks above launched besides, the author's count here is past 30
  await write(
    `mutation SeedStarts($rows: [CappedStart_Data!]!) {
      cappedStart_insertMany(data: $rows)
    }`,
    { rows },
  )

  check(
    'a launch past the member’s 30 subagents in 24 hours is refused, a lift left null holding',
    (await refusal(launchSubagent(dataConnect, launchVariables(parent, { isUsageCapped: null }).variables)))?.includes(
      'Somebody launches at most 30 subagents in 24 hours in an organization',
    ) ?? false,
  )
}

try {
  await setUp()
  await checkLaunching()
  await settleSubagentRuns()

  const ended = await checkEnding()

  await checkReading(ended)
  await settleSubagentRuns()
  await checkPageReads()
  await settleSubagentRuns()
  await checkMemberActions()
  await settleSubagentRuns()
  await checkCounts()
  await checkRunContexts(ended)
  await settleSubagentRuns()
  await checkSlots()
  await settleSubagentRuns()
  await checkChain()
  await settleSubagentRuns()
  await checkReactions()
  await checkCascades()
  await checkLaunchOrders()
  await checkDailyLaunches()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')
