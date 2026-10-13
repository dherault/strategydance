import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import { MAX_PENDING_CONVERSATION_ATTACHMENTS } from 'strategydance-core'
import {
  claimConversationAttachment,
  claimExpiredConversationAttachments,
  claimExpiredMemberConversationAttachments,
  completeConversationAttachmentUpload,
  connectorConfig,
  deleteConversationAttachments,
  deletePrunedConversationAttachments,
  getConversationAttachment,
  getConversationAttachmentUploadContext,
  getConversationAttachmentsByClaudeFileIds,
  getConversationPruneAttachments,
  getConversationRequestContext,
  getConversationRunControlContext,
  getConversationSendAttachments,
  getConversationSendContext,
  getOrganizationConversationAttachmentFiles,
  getPruningConversationAttachments,
  getPruningMemberConversationAttachments,
  releaseConversationAttachment,
  reserveConversationAttachment,
  sendConversationMessage,
  startConversation,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the conversation attachments' operations against the emulators, where CI cannot, since what
  they guard is in their SQL conditions:

    bun run check:conversation-attachments

  It makes a throwaway organization, a few members, conversations and files, runs the backend
  connector's own operations as the routes call them, and removes everything it made, then exits
  non-zero naming each check that failed. The domain's tests run against a fake of these operations:
  this is what says the fake's conditions are the SQL's.

  The emulator's PGlite runs one transaction at a time, so no race shows here: the reservation's
  lock on the membership is Postgres' reasoning, and this checks its count and conditions alone.
  The sweep's claim takes no member: it claims every expired file in the emulator, whoever's it is.

  Like `checkConversationRuns.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:conversation-attachments`',
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
  author: `check-conversation-attachments-${checkId}-author`,
  other: `check-conversation-attachments-${checkId}-other`,
  quota: `check-conversation-attachments-${checkId}-quota`,
  outsider: `check-conversation-attachments-${checkId}-outsider`,
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

async function setUp() {
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

  for (const userId of [userIds.author, userIds.other, userIds.quota]) {
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

type Attachment = {
  id: string
  userId: string
  conversationId: string
  status: 'UPLOADING' | 'READY' | 'PRUNING'
  messageId?: string | null
  name?: string
  contentType?: string
  claudeFileId?: string | null
  hoursAgo?: number
  minutesAgo?: number
}

// Files written straight into their table, as uploads long ago left them
async function insertAttachments(attachments: Attachment[]) {
  const rows = attachments.map(({ hoursAgo = 0, minutesAgo = 0, ...attachment }) => ({
    id: attachment.id,
    userId: attachment.userId,
    organizationId,
    conversationId: attachment.conversationId,
    messageId: attachment.messageId ?? null,
    status: attachment.status,
    name: attachment.name ?? 'Board.png',
    contentType: attachment.contentType ?? 'image/png',
    size: 1000,
    tokenCount: attachment.status === 'UPLOADING' ? null : 371,
    claudeFileId: attachment.status === 'UPLOADING' ? null : (attachment.claudeFileId ?? `file_${attachment.id}`),
    // A list's rows take no `_time` expression, and this machine's clock is the emulator's
    createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000 - minutesAgo * 60 * 1000).toISOString(),
  }))

  // In batches of 100, the most one insert takes
  for (let index = 0; index < rows.length; index += 100) {
    await write(
      `mutation InsertAttachments($rows: [ConversationAttachment_Data!]!) {
        conversationAttachment_insertMany(data: $rows)
      }`,
      { rows: rows.slice(index, index + 100) },
    )
  }
}

async function readAttachment(attachmentId: string) {
  const { data } = await getConversationAttachmentUploadContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: createId(),
    attachmentId,
  })

  return data.conversationAttachment ?? null
}

function reserve(userId: string, conversationId: string, overrides: Variables = {}) {
  return reserveConversationAttachment(dataConnect, {
    organizationId,
    userId,
    conversationId,
    attachmentId: createId(),
    name: 'Board.png',
    contentType: 'image/png',
    size: 1000,
    ...overrides,
  })
}

// Ends every run of somebody's and leaves their conversations idle, so the next start or send is
// never held by their 3 runs in flight
async function settle(userId: string) {
  await write(
    `mutation Settle($userId: String!) {
      conversationRun_updateMany(where: { conversation: { userId: { eq: $userId } } }, data: { status: COMPLETED })
      conversation_updateMany(where: { userId: { eq: $userId } }, data: { activeRunId: null })
    }`,
    { userId },
  )
}

// A conversation of somebody's, started with a message of files when it names some
async function start(userId: string, attachmentIds?: string[]) {
  await settle(userId)

  const started = {
    organizationId,
    userId,
    conversationId: createId(),
    membershipCreatedAt: await readMembershipCreatedAt(userId),
    messageId: createId(),
    runId: createId(),
  }

  await startConversation(dataConnect, {
    ...started,
    title: 'Checked conversation',
    text: '',
    preview: { kind: 'MEMBER_TEXT', text: '' },
    content: '[]',
    ...(attachmentIds ? { attachmentIds } : {}),
  })

  return started
}

async function checkReserving() {
  const draftId = createId()
  const theirs = await start(userIds.other, [])

  check('a member reserves a file in a draft', (await refusal(reserve(userIds.author, draftId))) === null)
  check(
    'a reservation is refused to somebody who is no member',
    (await refusal(reserve(userIds.outsider, draftId)))?.includes('Only a member') === true,
  )
  check(
    'a reservation is refused under somebody else’s conversation',
    (await refusal(reserve(userIds.author, theirs.conversationId)))?.includes('somebody else') === true,
  )

  for (const [name, overrides] of [
    ['a name on two lines', { name: 'a\nb.png' }],
    ['a name past 200 characters', { name: 'a'.repeat(201) }],
    ['a type a conversation does not take', { contentType: 'image/svg+xml' }],
    ['no byte', { size: 0 }],
    ['more than 10 MiB', { size: 10 * 1024 * 1024 + 1 }],
  ] as const) {
    check(`a reservation of ${name} is refused`, (await refusal(reserve(userIds.author, draftId, overrides))) !== null)
  }

  check(
    'a name of 200 emoji is taken, counted in characters',
    (await refusal(reserve(userIds.author, draftId, { name: '🌞'.repeat(200) }))) === null,
  )

  const attachmentId = createId()

  await reserve(userIds.author, draftId, { attachmentId })
  check(
    'a second reservation with the same id is refused by its key',
    (await refusal(reserve(userIds.author, draftId, { attachmentId }))) !== null,
  )
}

async function checkQuota() {
  const draftId = createId()

  await insertAttachments([
    ...Array.from({ length: MAX_PENDING_CONVERSATION_ATTACHMENTS - 1 }, () => ({
      id: createId(),
      userId: userIds.quota,
      conversationId: draftId,
      status: 'READY' as const,
    })),
    // Not counted: uploaded over two days ago, which a prune takes
    { id: createId(), userId: userIds.quota, conversationId: draftId, status: 'READY', hoursAgo: 49 },
    // Not counted: another member's
    { id: createId(), userId: userIds.other, conversationId: draftId, status: 'READY' },
  ])

  check('the 30th unsent file is reserved', (await refusal(reserve(userIds.quota, draftId))) === null)
  check(
    'the 31st is refused, the old one and another member’s not counted',
    (await refusal(reserve(userIds.quota, draftId)))?.includes('at most 30 files') === true,
  )
}

async function checkUploading() {
  const draftId = createId()
  const attachmentId = createId()
  const location = { organizationId, userId: userIds.author, conversationId: draftId, attachmentId }

  await reserve(userIds.author, draftId, { attachmentId })

  check(
    'a reservation is released while it uploads',
    (await releaseConversationAttachment(dataConnect, location)).data.conversationAttachment_updateMany === 1,
  )

  const finished = createId()
  const finishedLocation = { ...location, attachmentId: finished }
  const complete = () =>
    completeConversationAttachmentUpload(dataConnect, {
      ...finishedLocation,
      pageCount: null,
      tokenCount: 371,
      claudeFileId: `file_${finished}`,
    })

  await reserve(userIds.author, draftId, { attachmentId: finished })

  check(
    'an upload finishes only for its author',
    (await refusal(
      completeConversationAttachmentUpload(dataConnect, {
        ...finishedLocation,
        userId: userIds.other,
        tokenCount: 1,
        claudeFileId: 'file_other',
      }),
    )) !== null,
  )
  check('an upload finishes its reservation', (await refusal(complete())) === null)
  check('an upload finishes once', (await refusal(complete())) !== null)
  check('a finished file is ready, with its count', (await readAttachment(finished))?.status === 'READY')
  check(
    'a ready file is never released',
    (await releaseConversationAttachment(dataConnect, finishedLocation)).data.conversationAttachment_updateMany === 0,
  )
  check(
    'a removal is never claimed for somebody else’s file',
    (await claimConversationAttachment(dataConnect, { ...finishedLocation, userId: userIds.other })).data
      .conversationAttachment_updateMany === 0,
  )
  check(
    'a removal claims the author’s ready file',
    (await claimConversationAttachment(dataConnect, finishedLocation)).data.conversationAttachment_updateMany === 1,
  )
  check(
    'a claimed file finishes no upload',
    (await refusal(
      completeConversationAttachmentUpload(dataConnect, {
        ...finishedLocation,
        tokenCount: 371,
        claudeFileId: 'file_again',
      }),
    )) !== null,
  )

  const kept = createId()

  await insertAttachments([{ id: kept, userId: userIds.author, conversationId: draftId, status: 'READY' }])

  const { data } = await getConversationAttachment(dataConnect, { ...location, attachmentId: kept })

  check('a file reads back by its conversation, author and organization', data.conversationAttachments.length === 1)
  check(
    'a file reads back for nobody else',
    (await getConversationAttachment(dataConnect, { ...location, attachmentId: kept, userId: userIds.other })).data
      .conversationAttachments.length === 0,
  )

  const pruned = await deletePrunedConversationAttachments(dataConnect, { ids: [attachmentId, finished, kept] })

  check(
    'the claimed files are deleted, and the ready one is kept',
    pruned.data.conversationAttachment_deleteMany === 2 && (await readAttachment(kept)) !== null,
  )
}

async function checkExpiring() {
  const draftId = createId()
  const ids = {
    stale: createId(),
    uploading: createId(),
    old: createId(),
    young: createId(),
    sent: createId(),
    others: createId(),
  }
  const theirs = await start(userIds.author, [])

  await insertAttachments([
    { id: ids.stale, userId: userIds.author, conversationId: draftId, status: 'UPLOADING', minutesAgo: 11 },
    { id: ids.uploading, userId: userIds.author, conversationId: draftId, status: 'UPLOADING', minutesAgo: 5 },
    { id: ids.old, userId: userIds.author, conversationId: draftId, status: 'READY', hoursAgo: 49 },
    { id: ids.young, userId: userIds.author, conversationId: draftId, status: 'READY', hoursAgo: 47 },
    { id: ids.others, userId: userIds.other, conversationId: draftId, status: 'READY', hoursAgo: 49 },
  ])
  await insertAttachments([
    { id: ids.sent, userId: userIds.author, conversationId: theirs.conversationId, status: 'READY', hoursAgo: 72 },
  ])
  await write(
    `mutation Send($id: UUID!, $messageId: UUID!) {
      conversationAttachment_update(id: $id, data: { messageId: $messageId })
    }`,
    { id: ids.sent, messageId: theirs.messageId },
  )

  const member = await claimExpiredMemberConversationAttachments(dataConnect, {
    organizationId,
    userId: userIds.author,
  })
  const statuses = async () =>
    Object.fromEntries(
      await Promise.all(Object.entries(ids).map(async ([name, id]) => [name, (await readAttachment(id))?.status])),
    )
  const claimed = await statuses()

  check(
    'a member’s claim takes their stale reservation and their file two days old',
    member.data.conversationAttachment_updateMany === 2,
  )
  check(
    'it leaves a young reservation, a file under two days old, a sent file and another member’s',
    claimed.stale === 'PRUNING'
      && claimed.old === 'PRUNING'
      && claimed.uploading === 'UPLOADING'
      && claimed.young === 'READY'
      && claimed.sent === 'READY'
      && claimed.others === 'READY',
  )

  const { data: memberPruning } = await getPruningMemberConversationAttachments(dataConnect, {
    organizationId,
    userId: userIds.author,
  })

  check(
    'a member’s prune reads the files their claim took, and no one else’s',
    memberPruning.conversationAttachments
      .map(({ id }) => id)
      .sort()
      .join() === [ids.stale, ids.old].sort().join(),
  )

  await claimExpiredConversationAttachments(dataConnect)

  check('the sweep’s claim takes another member’s expired file too', (await statuses()).others === 'PRUNING')

  const { data } = await getPruningConversationAttachments(dataConnect)

  check(
    'the sweep reads the claimed files, whoever’s they are',
    [ids.stale, ids.old, ids.others].every(id => data.conversationAttachments.some(attachment => attachment.id === id)),
  )
  check(
    'a file sent is never deleted as a pruned one',
    (await deletePrunedConversationAttachments(dataConnect, { ids: [ids.sent] })).data.conversationAttachment_deleteMany
      === 0,
  )
  await deletePrunedConversationAttachments(dataConnect, {
    ids: data.conversationAttachments.map(({ id }) => id),
  })
}

async function checkSending() {
  const draftId = createId()
  const ready = [createId(), createId()]
  const uploading = createId()
  const others = createId()

  await insertAttachments([
    { id: ready[0] ?? '', userId: userIds.author, conversationId: draftId, status: 'READY', hoursAgo: 0.02 },
    {
      id: ready[1] ?? '',
      userId: userIds.author,
      conversationId: draftId,
      status: 'READY',
      name: 'Plan.pdf',
      hoursAgo: 0.01,
    },
    { id: uploading, userId: userIds.author, conversationId: draftId, status: 'UPLOADING' },
    { id: others, userId: userIds.other, conversationId: draftId, status: 'READY' },
  ])

  await settle(userIds.author)

  const membershipCreatedAt = await readMembershipCreatedAt(userIds.author)
  const base = {
    organizationId,
    userId: userIds.author,
    conversationId: draftId,
    membershipCreatedAt,
    title: 'Checked conversation',
    text: '',
    preview: { kind: 'MEMBER_TEXT', text: '' },
    content: '[]',
  }

  check(
    'a message sending a file still uploading is refused whole',
    (
      await refusal(
        startConversation(dataConnect, {
          ...base,
          messageId: createId(),
          runId: createId(),
          attachmentIds: [uploading],
        }),
      )
    )?.includes('files changed') === true,
  )
  check(
    'a message sending another member’s file uploaded under the same id is refused',
    (await refusal(
      startConversation(dataConnect, { ...base, messageId: createId(), runId: createId(), attachmentIds: [others] }),
    )) !== null,
  )
  check(
    'a message sending more than 10 files is refused',
    (
      await refusal(
        startConversation(dataConnect, {
          ...base,
          messageId: createId(),
          runId: createId(),
          attachmentIds: Array.from({ length: 11 }, createId),
        }),
      )
    )?.includes('at most 10 files') === true,
  )

  const sendContext = await getConversationSendContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: draftId,
    messageId: createId(),
  })

  check('a refused message leaves no conversation', !sendContext.data.conversation)

  const messageId = createId()

  check(
    'a message sends its files, ready and its author’s',
    (await refusal(startConversation(dataConnect, { ...base, messageId, runId: createId(), attachmentIds: ready })))
      === null,
  )
  check(
    'each file it sends names it',
    (await Promise.all(ready.map(readAttachment))).every(attachment => attachment?.messageId === messageId),
  )
  check('another member’s file under the same id is left alone', (await readAttachment(others))?.messageId === null)

  const { data: control } = await getConversationRunControlContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: draftId,
  })

  check(
    'the message reads its files’ names in the order they were uploaded',
    JSON.stringify(control.latestMessages[0]?.conversationAttachments_on_message.map(({ name }) => name))
      === JSON.stringify(['Board.png', 'Plan.pdf']),
  )

  const { data: budget } = await getConversationSendAttachments(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: draftId,
    attachmentIds: [uploading, others],
  })

  check(
    'a send reads the files it names, its author’s, and the conversation’s sent ones',
    budget.named.map(({ id }) => id).join() === uploading && budget.sent.length === 2,
  )

  const { data: requestContext } = await getConversationRequestContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: draftId,
  })

  check(
    'a run reads the counts of the files its conversation sent',
    requestContext.conversationAttachments.length === 2
      && requestContext.conversationAttachments.every(({ tokenCount }) => tokenCount === 371),
  )

  // A second message, with no file: an empty list associates nothing
  await settle(userIds.author)

  const { data: next } = await getConversationSendContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: draftId,
    messageId: createId(),
  })
  const send = (attachmentIds?: string[]) =>
    sendConversationMessage(dataConnect, {
      organizationId,
      userId: userIds.author,
      conversationId: draftId,
      membershipCreatedAt,
      messageId: createId(),
      text: 'And this?',
      preview: { kind: 'MEMBER_TEXT', text: 'And this?' },
      position: next.conversation?.nextMessagePosition ?? 0,
      runId: createId(),
      runNumber: next.conversation?.nextRunNumber ?? 0,
      content: '[]',
      transcriptPosition: 1,
      ...(attachmentIds ? { attachmentIds } : {}),
    })

  check('a message with an empty list of files is sent, and sends none', (await refusal(send([]))) === null)

  await settle(userIds.author)
  await write(
    `mutation Ready($id: UUID!) {
      conversationAttachment_update(id: $id, data: { status: READY, tokenCount: 1, claudeFileId: "file_late" })
    }`,
    { id: uploading },
  )

  // A backend from before M25 names no list. Data Connect drops a filter on a list variable left out,
  // so the step matches every file waiting, and its check refuses the send rather than take one
  // nobody named
  const { data: later } = await getConversationSendContext(dataConnect, {
    organizationId,
    userId: userIds.author,
    conversationId: draftId,
    messageId: createId(),
  })
  const absent = await refusal(
    sendConversationMessage(dataConnect, {
      organizationId,
      userId: userIds.author,
      conversationId: draftId,
      membershipCreatedAt,
      messageId: createId(),
      text: 'From before',
      preview: { kind: 'MEMBER_TEXT', text: 'From before' },
      position: later.conversation?.nextMessagePosition ?? 0,
      runId: createId(),
      runNumber: later.conversation?.nextRunNumber ?? 0,
      content: '[]',
      transcriptPosition: 2,
    }),
  )

  check(
    'a send naming no list, with a file waiting, is refused rather than take it',
    absent?.includes('files changed') === true && (await readAttachment(uploading))?.messageId === null,
  )
}

async function checkPruning() {
  const conversation = await start(userIds.author, [])
  const sent = createId()
  const unsent = createId()
  const others = createId()

  await insertAttachments([
    { id: sent, userId: userIds.author, conversationId: conversation.conversationId, status: 'READY' },
    { id: unsent, userId: userIds.author, conversationId: conversation.conversationId, status: 'READY' },
    { id: others, userId: userIds.other, conversationId: conversation.conversationId, status: 'READY' },
  ])

  const location = { organizationId, userId: userIds.author, conversationId: conversation.conversationId }

  check(
    'a live conversation never loses its files',
    (await refusal(deleteConversationAttachments(dataConnect, location)))?.includes('a prune claimed') === true,
  )

  await write(
    `mutation Claim($id: UUID!) {
      conversation_update(id: $id, data: { deletedAt_time: { now: true, sub: { days: 2 } }, pruneClaimedAt_expr: "request.time" })
    }`,
    { id: conversation.conversationId },
  )

  const { data } = await getConversationPruneAttachments(dataConnect, location)

  check('a prune reads the author’s files of the conversation, and no other', data.conversationAttachments.length === 2)
  check(
    'a claimed conversation loses its author’s files, and keeps another member’s',
    (await deleteConversationAttachments(dataConnect, location)).data.conversationAttachment_deleteMany === 2
      && (await readAttachment(others)) !== null,
  )
}

async function checkFiles() {
  const draftId = createId()
  const names = Array.from({ length: 150 }, (_, index) => `file_${checkId}_${String(index).padStart(3, '0')}`)

  await insertAttachments(
    names.map(claudeFileId => ({
      id: createId(),
      userId: userIds.other,
      conversationId: draftId,
      status: 'READY' as const,
      claudeFileId,
    })),
  )

  const read: string[] = []

  for (;;) {
    const { data } = await getOrganizationConversationAttachmentFiles(dataConnect, {
      organizationId,
      afterClaudeFileId: read.at(-1) ?? '',
    })

    read.push(...data.conversationAttachments.flatMap(({ claudeFileId }) => (claudeFileId ? [claudeFileId] : [])))

    if (data.conversationAttachments.length < 100) break
  }

  check(
    'an organization’s files are read every page, in order',
    names.every(name => read.includes(name)),
  )

  const { data } = await getConversationAttachmentsByClaudeFileIds(dataConnect, {
    claudeFileIds: [names[0] ?? '', 'file_nobody_names'],
  })

  check(
    'the sweep finds the files a row names, and not the others',
    data.conversationAttachments.map(({ claudeFileId }) => claudeFileId).join() === names[0],
  )
}

try {
  await setUp()
  await checkReserving()
  await checkQuota()
  await checkUploading()
  await checkExpiring()
  await checkSending()
  await checkPruning()
  await checkFiles()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')
