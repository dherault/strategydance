import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  connectorConfig,
  getKnowledgeDocumentLinkForAgent,
  getKnowledgeItemsForAgent,
  getKnowledgeMemberLinkForAgent,
  getKnowledgeTaskLinkForAgent,
  getKnowledgeUsesForAgent,
  getModuleCallResult,
  KnowledgeKind,
  linkKnowledgeDocumentForAgent,
  linkKnowledgeMemberForAgent,
  linkKnowledgeTaskForAgent,
  pruneDeletedTasks,
  setKnowledgeInUseForAgent,
  unlinkKnowledgeDocumentForAgent,
  unlinkKnowledgeMemberForAgent,
  unlinkKnowledgeTaskForAgent,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the Knowledge module's operations against the emulators, where CI cannot, since what they
  guard is in their SQL conditions and their tables' references:

    bun run check:knowledge-module

  It makes two throwaway organizations, one with an administrator and a member and one with a member
  of its own, calls the backend connector's own operations as the module calls them, and the web
  connector's `RemoveOrganizationMember` as the administrator, removes everything it made, then exits
  non-zero naming each check that failed. The module's tests run against a fake of these operations:
  this is what says the fake's conditions are the SQL's.

  `PruneDeletedTasks` is the sweep's and takes no organization, so it prunes every task the emulator
  holds deleted over a day ago; nothing else here reaches past the two organizations.

  Like `checkTasksModule.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:knowledge-module`',
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
const otherOrganizationId = createId()
const userId = `check-knowledge-module-${checkId}-member`
const teammateId = `check-knowledge-module-${checkId}-teammate`
const outsiderId = `check-knowledge-module-${checkId}-outsider`
const scope = `connection:check-${checkId}`
const HOUR_MS = 60 * 60 * 1000

// The items the checks mark and link, a tactic's ids, which the operations take as they are
const ITEM = 'send-cold-emails'
const OTHER_ITEM = 'answer-questions-on-reddit'
const CAPPED_ITEM = 'write-an-onboarding-email-sequence'

// The createdAt of a membership that ended, which no operation finds
const STALE = '2020-01-01T00:00:00Z'

// What the agent's writes take for a call without a key
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

async function isRefused(operation: Promise<unknown>, cause: string) {
  return (await refusal(operation))?.includes(cause) ?? false
}

async function isAccepted(operation: Promise<unknown>) {
  return (await refusal(operation)) === null
}

const memberships: Record<string, string> = {}

function caller(organization = organizationId) {
  return { organizationId: organization, userId, membershipCreatedAt: memberships[organization] ?? '' }
}

function stale() {
  return { ...caller(), membershipCreatedAt: STALE }
}

// The variables every operation of an item takes, as the module calls it for the member
function item(itemId = ITEM, who = caller()) {
  return { ...who, kind: KnowledgeKind.MARKETING_TACTIC, itemId }
}

async function insertDocument(fields: Variables = {}, organization = organizationId) {
  const id = createId()

  await write(`mutation InsertDocument($data: Document_Data!) { document_insert(data: $data) }`, {
    data: { id, organizationId: organization, title: 'Cold email script', content: '', contentText: '', ...fields },
  })

  return id
}

async function insertTask(fields: Variables = {}, organization = organizationId) {
  const id = createId()

  await write(`mutation InsertTask($data: Task_Data!) { task_insert(data: $data) }`, {
    data: {
      id,
      organizationId: organization,
      name: 'Send the first cold emails',
      description: '',
      descriptionText: '',
      status: 'TODO',
      position: 1,
      ...fields,
    },
  })

  return id
}

// The links of every kind an item holds, read straight from their tables, whatever the agent sees
async function readLinks(itemId = ITEM) {
  return read<{
    knowledgeDocumentLinks: { documentId: string }[]
    knowledgeTaskLinks: { taskId: string }[]
    knowledgeMemberLinks: { membershipUserId: string }[]
  }>(
    `query ReadLinks($organizationId: UUID!, $itemId: String!) {
      knowledgeDocumentLinks(where: { organizationId: { eq: $organizationId }, itemId: { eq: $itemId } }) { documentId }
      knowledgeTaskLinks(where: { organizationId: { eq: $organizationId }, itemId: { eq: $itemId } }, limit: 200) { taskId }
      knowledgeMemberLinks(where: { organizationId: { eq: $organizationId }, itemId: { eq: $itemId } }) { membershipUserId }
    }`,
    { organizationId, itemId },
  )
}

async function setUp() {
  for (const member of [userId, teammateId, outsiderId]) {
    await webConnector.executeMutation(
      'CreateCurrentUser',
      { locale: 'EN', authenticationProviders: [] },
      { impersonate: { authClaims: { sub: member, email: `${member}@example.com` } } },
    )
  }

  await write(
    `mutation SetUp($organizationId: UUID!, $otherOrganizationId: UUID!, $userId: String!, $teammateId: String!, $outsiderId: String!) {
      organization_insert(data: { id: $organizationId, name: "Checked organization" })
      other: organization_insert(data: { id: $otherOrganizationId, name: "Other organization" })
      userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: ADMINISTRATOR })
      teammate: userOrganization_insert(data: { userId: $teammateId, organizationId: $organizationId, role: MEMBER })
      outsider: userOrganization_insert(data: { userId: $outsiderId, organizationId: $otherOrganizationId, role: MEMBER })
    }`,
    { organizationId, otherOrganizationId, userId, teammateId, outsiderId },
  )

  const data = await read<{ userOrganization: { createdAt: string } }>(
    `query ReadMembership($organizationId: UUID!, $userId: String!) {
      userOrganization(key: { userId: $userId, organizationId: $organizationId }) { createdAt }
    }`,
    { organizationId, userId },
  )

  memberships[organizationId] = data.userOrganization.createdAt
}

async function tearDown() {
  await write(
    `mutation TearDown($ids: [UUID!]!, $userIds: [String!]!) {
      organization_deleteMany(where: { id: { in: $ids } })
      user_deleteMany(where: { id: { in: $userIds } })
    }`,
    { ids: [organizationId, otherOrganizationId], userIds: [userId, teammateId, outsiderId] },
  )
}

async function checkUses() {
  const set = (isInUse: boolean, who = caller()) =>
    setKnowledgeInUseForAgent(dataConnect, { ...item(ITEM, who), isInUse, ...UNKEYED })

  check('a stale membership is refused marking an item', await isRefused(set(true, stale()), 'no longer a member'))
  check('marking an item goes through', await isAccepted(set(true)))

  const uses = await getKnowledgeUsesForAgent(dataConnect, { ...caller(), kind: KnowledgeKind.MARKETING_TACTIC })

  check(
    'the uses read lists the item in use, with its kind',
    uses.data.membership.length === 1
      && uses.data.knowledgeUses.length === 1
      && uses.data.knowledgeUses[0]!.itemId === ITEM
      && uses.data.knowledgeUses[0]!.kind === KnowledgeKind.MARKETING_TACTIC,
  )

  check('clearing it goes through', await isAccepted(set(false)))

  const rows = await read<{ knowledgeUses: { isInUse: boolean; changedAt: string; changedById: string | null }[] }>(
    `query ReadUses($organizationId: UUID!) {
      knowledgeUses(where: { organizationId: { eq: $organizationId } }) { isInUse changedAt changedById }
    }`,
    { organizationId },
  )

  check(
    'the upsert keeps one row, cleared, its changedBy the member',
    rows.knowledgeUses.length === 1 && !rows.knowledgeUses[0]!.isInUse && rows.knowledgeUses[0]!.changedById === userId,
  )

  const cleared = await getKnowledgeUsesForAgent(dataConnect, { ...caller(), kind: KnowledgeKind.MARKETING_TACTIC })

  check('the uses read leaves out an item no longer in use', cleared.data.knowledgeUses.length === 0)

  const items = await getKnowledgeItemsForAgent(dataConnect, {
    ...caller(),
    kind: KnowledgeKind.MARKETING_TACTIC,
    itemIds: [ITEM, OTHER_ITEM],
  })

  check(
    "the items read answers the item's use, and nothing of one never marked",
    items.data.knowledgeUses.length === 1
      && items.data.knowledgeUses[0]!.itemId === ITEM
      && !items.data.knowledgeUses[0]!.isInUse
      && Date.parse(items.data.knowledgeUses[0]!.changedAt) === Date.parse(rows.knowledgeUses[0]!.changedAt),
  )

  const staleUses = await getKnowledgeUsesForAgent(dataConnect, { ...stale(), kind: KnowledgeKind.MARKETING_TACTIC })
  const staleItems = await getKnowledgeItemsForAgent(dataConnect, {
    ...stale(),
    kind: KnowledgeKind.MARKETING_TACTIC,
    itemIds: [ITEM],
  })

  check(
    'both reads answer no membership and no row for a stale membership',
    staleUses.data.membership.length === 0
      && staleUses.data.knowledgeUses.length === 0
      && staleItems.data.membership.length === 0
      && staleItems.data.knowledgeUses.length === 0,
  )

  const other = await getKnowledgeItemsForAgent(dataConnect, {
    ...caller(otherOrganizationId),
    membershipCreatedAt: memberships[organizationId]!,
    kind: KnowledgeKind.MARKETING_TACTIC,
    itemIds: [ITEM],
  })

  check(
    "another organization's caller reads nothing of this one's",
    other.data.membership.length === 0 && other.data.knowledgeUses.length === 0,
  )
}

async function checkDocumentLinks() {
  const readable = await insertDocument()
  const kept = await insertDocument({ isAiReadable: false })
  const deleted = await insertDocument({ deletedAt: new Date().toISOString() })
  const elsewhere = await insertDocument({}, otherOrganizationId)
  const link = (documentId: string, who = caller()) =>
    linkKnowledgeDocumentForAgent(dataConnect, { ...item(ITEM, who), documentId, ...UNKEYED })
  const unlink = (documentId: string, who = caller()) =>
    unlinkKnowledgeDocumentForAgent(dataConnect, { ...item(ITEM, who), documentId, ...UNKEYED })

  check(
    'a stale membership is refused linking a document',
    await isRefused(link(readable, stale()), 'no longer a member'),
  )
  check('a document kept from AI is refused', await isRefused(link(kept), 'No document agents may read'))
  check('a deleted document is refused', await isRefused(link(deleted), 'No document agents may read'))
  check("another organization's document is refused", await isRefused(link(elsewhere), 'No document agents may read'))
  check('a document the agent may read is linked', await isAccepted(link(readable)))

  check(
    'a link there already is refused on its key alone',
    await isRefused(link(readable), 'knowledge_document_link_pkey'),
  )

  const target = await getKnowledgeDocumentLinkForAgent(dataConnect, { ...item(), documentId: readable })

  check(
    'the target read answers the document and every link of the item',
    target.data.documents[0]?.title === 'Cold email script'
      && target.data.documents[0].isAiReadable
      && target.data.knowledgeDocumentLinks.map(({ documentId }) => documentId).join() === readable,
  )

  await write(`mutation KeepFromAi($id: UUID!) { document_update(id: $id, data: { isAiReadable: false }) }`, {
    id: readable,
  })

  const hidden = await getKnowledgeItemsForAgent(dataConnect, {
    ...caller(),
    kind: KnowledgeKind.MARKETING_TACTIC,
    itemIds: [ITEM],
  })
  const counted = await getKnowledgeDocumentLinkForAgent(dataConnect, { ...item(), documentId: readable })

  check(
    'the items read leaves out a link to a document since kept from AI',
    hidden.data.knowledgeDocumentLinks.length === 0,
  )
  check(
    'the target read still counts it, and says the document is kept from AI',
    counted.data.knowledgeDocumentLinks.length === 1 && counted.data.documents[0]?.isAiReadable === false,
  )
  check(
    'an unlink of a document since kept from AI removes nothing',
    await isRefused(unlink(readable), 'The item is not linked to that document'),
  )

  await write(`mutation LetAiRead($id: UUID!) { document_update(id: $id, data: { isAiReadable: true }) }`, {
    id: readable,
  })

  check('a stale membership is refused unlinking', await isRefused(unlink(readable, stale()), 'no longer a member'))
  check('the document is unlinked', await isAccepted(unlink(readable)))
  check(
    'unlinking it again is refused, as nothing is linked',
    await isRefused(unlink(readable), 'The item is not linked to that document'),
  )
  check('no document link is left', (await readLinks()).knowledgeDocumentLinks.length === 0)
}

async function checkTaskLinks() {
  const live = await insertTask()
  const deleted = await insertTask({ deletedAt: new Date().toISOString() })
  const elsewhere = await insertTask({}, otherOrganizationId)
  const link = (taskId: string, itemId = ITEM, who = caller()) =>
    linkKnowledgeTaskForAgent(dataConnect, { ...item(itemId, who), taskId, ...UNKEYED })

  check(
    'a stale membership is refused linking a task',
    await isRefused(link(live, ITEM, stale()), 'no longer a member'),
  )
  check('a deleted task is refused', await isRefused(link(deleted), 'No task by that id in the organization'))
  check(
    "another organization's task is refused",
    await isRefused(link(elsewhere), 'No task by that id in the organization'),
  )

  const key = `check-${checkId}-link`
  const keyed = await refusal(
    linkKnowledgeTaskForAgent(dataConnect, {
      ...item(),
      taskId: live,
      isKeyed: true,
      idempotencyScope: scope,
      idempotencyKey: key,
      tool: 'link_knowledge',
      argumentsHash: 'hash',
      result: '{"isNew":true}',
      expiresAt: null,
    }),
  )
  const stored = await getModuleCallResult(dataConnect, {
    ...caller(),
    idempotencyScope: scope,
    idempotencyKey: key,
  })

  check(
    'a live task is linked, its result kept under its key',
    keyed === null && stored.data.moduleCallResult?.result === '{"isNew":true}',
  )

  const target = await getKnowledgeTaskLinkForAgent(dataConnect, { ...item(), taskId: deleted })

  check(
    "the target read answers a deleted task's deletion, and the item's links",
    target.data.tasks[0]?.deletedAt != null && target.data.knowledgeTaskLinks.length === 1,
  )

  check(
    'an unlink of a deleted task removes nothing',
    await isRefused(
      unlinkKnowledgeTaskForAgent(dataConnect, { ...item(), taskId: deleted, ...UNKEYED }),
      'The item is not linked to that task',
    ),
  )
  check(
    'the task is unlinked',
    await isAccepted(unlinkKnowledgeTaskForAgent(dataConnect, { ...item(), taskId: live, ...UNKEYED })),
  )
}

async function checkMemberLinks() {
  const link = (memberId: string, who = caller()) =>
    linkKnowledgeMemberForAgent(dataConnect, { ...item(ITEM, who), memberId, ...UNKEYED })

  check(
    'a stale membership is refused linking a member',
    await isRefused(link(teammateId, stale()), 'no longer a member'),
  )
  check(
    "another organization's member is refused",
    await isRefused(link(outsiderId), 'An item links a member of its organization'),
  )
  check('the member the agent acts as is linked', await isAccepted(link(userId)))
  check('a teammate is linked', await isAccepted(link(teammateId)))

  const target = await getKnowledgeMemberLinkForAgent(dataConnect, { ...item(), memberId: teammateId })

  check(
    'the target read answers the member, and every member the item links',
    target.data.members.length === 1 && target.data.knowledgeMemberLinks.length === 2,
  )
  check(
    'the member the agent acts as is unlinked',
    await isAccepted(unlinkKnowledgeMemberForAgent(dataConnect, { ...item(), memberId: userId, ...UNKEYED })),
  )
}

async function checkCap() {
  const tasks = Array.from({ length: 100 }, () => createId())
  const rows = tasks.map((id, index) => ({
    id,
    organizationId,
    name: `Batch ${index}`,
    description: '',
    descriptionText: '',
    status: 'TODO',
    position: index,
  }))

  await write(`mutation Fill($rows: [Task_Data!]!) { task_insertMany(data: $rows) }`, { rows })
  await write(`mutation Link($rows: [KnowledgeTaskLink_Data!]!) { knowledgeTaskLink_insertMany(data: $rows) }`, {
    rows: tasks.map(taskId => ({ organizationId, kind: 'MARKETING_TACTIC', itemId: CAPPED_ITEM, taskId })),
  })

  const extra = await insertTask()
  const document = await insertDocument()
  const link = (taskId: string) => linkKnowledgeTaskForAgent(dataConnect, { ...item(CAPPED_ITEM), taskId, ...UNKEYED })

  check("an item's 101st task is refused", await isRefused(link(extra), 'An item links at most 100 tasks'))
  check(
    'one of its 100 tasks linked again is refused on its key, not the cap',
    await isRefused(link(tasks[0]!), 'knowledge_task_link_pkey'),
  )
  check(
    'a document can still be linked to it',
    await isAccepted(
      linkKnowledgeDocumentForAgent(dataConnect, { ...item(CAPPED_ITEM), documentId: document, ...UNKEYED }),
    ),
  )
  check(
    'the 101st task can be linked to another item',
    await isAccepted(linkKnowledgeTaskForAgent(dataConnect, { ...item(OTHER_ITEM), taskId: extra, ...UNKEYED })),
  )

  const items = await getKnowledgeItemsForAgent(dataConnect, {
    ...caller(),
    kind: KnowledgeKind.MARKETING_TACTIC,
    itemIds: [CAPPED_ITEM, OTHER_ITEM],
  })

  check(
    'the items read answers every link of the ids, newest first',
    items.data.knowledgeTaskLinks.filter(({ itemId }) => itemId === CAPPED_ITEM).length === 100
      && items.data.knowledgeTaskLinks[0]!.itemId === OTHER_ITEM,
  )
}

async function checkCascades() {
  const pruned = await insertTask({ deletedAt: new Date(Date.now() - 25 * HOUR_MS).toISOString() })

  await write(
    `mutation Link($organizationId: UUID!, $taskId: UUID!) {
      knowledgeTaskLink_insert(data: { organizationId: $organizationId, kind: MARKETING_TACTIC, itemId: "${OTHER_ITEM}", taskId: $taskId })
    }`,
    { organizationId, taskId: pruned },
  )

  const skipped = await getKnowledgeItemsForAgent(dataConnect, {
    ...caller(),
    kind: KnowledgeKind.MARKETING_TACTIC,
    itemIds: [OTHER_ITEM],
  })

  check(
    "the items read skips a deleted task's link",
    !skipped.data.knowledgeTaskLinks.some(({ task }) => task.id === pruned),
  )

  await pruneDeletedTasks(dataConnect)

  check(
    'a link goes with its task once the task is pruned',
    !(await readLinks(OTHER_ITEM)).knowledgeTaskLinks.some(({ taskId }) => taskId === pruned),
  )

  check(
    'the teammate is linked before they are removed',
    (await readLinks()).knowledgeMemberLinks.some(({ membershipUserId }) => membershipUserId === teammateId),
  )

  await webConnector.executeMutation(
    'RemoveOrganizationMember',
    { organizationId, userId: teammateId },
    { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } },
  )

  check('a link goes with its member once they are removed', (await readLinks()).knowledgeMemberLinks.length === 0)
}

try {
  await setUp()
  await checkUses()
  await checkDocumentLinks()
  await checkTaskLinks()
  await checkMemberLinks()
  await checkCap()
  await checkCascades()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')

process.exit(0)
