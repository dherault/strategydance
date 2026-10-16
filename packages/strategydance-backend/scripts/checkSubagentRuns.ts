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
  claimQueuedConversationRun,
  connectorConfig,
  drawSubagentAgentText,
  finishConversationRun,
  finishSubagentRun,
  finishSubagentRunWithNote,
  getConversationRequestContext,
  getConversationRunContext,
  getConversationSearchCorpus,
  getConversationSendContext,
  getSubagentSlots,
  interruptDeadConversationRun,
  interruptDeadSubagentRun,
  interruptPendingSubagentRun,
  interruptSubagentRun,
  launchPendingSubagent,
  launchSubagent,
  promoteSubagentRun,
  requestConversationRunStop,
  reserveConversationAttachment,
  retryConversationRun,
  searchConversationMessages,
  searchConversationTitles,
  searchConversationsBySubstring,
  sendConversationMessage,
  startConversation,
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
async function insertFile(conversationId: string, messageId: string | null) {
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
    { id, userId: userIds.author, organizationId, conversationId, messageId, claudeFileId: `file_${id}` },
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

try {
  await setUp()
  await checkLaunching()
  await settleSubagentRuns()

  const ended = await checkEnding()

  await checkReading(ended)
  await settleSubagentRuns()
  await checkMemberActions()
  await settleSubagentRuns()
  await checkCounts()
  await checkRunContexts(ended)
  await settleSubagentRuns()
  await checkSlots()
  await settleSubagentRuns()
  await checkChain()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')
