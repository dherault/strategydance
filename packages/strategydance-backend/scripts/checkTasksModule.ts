import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  addTaskDependencyForAgent,
  connectorConfig,
  createTaskForAgent,
  deleteTaskForAgent,
  getModuleCallResult,
  getTaskBoardForAgent,
  getTaskForAgent,
  getUnindexedTasks,
  getUnindexedTasksForAgent,
  indexTaskText,
  indexTaskTextForAgent,
  removeTaskDependencyForAgent,
  restoreTaskForAgent,
  searchTasksForAgent,
  TaskStatus,
  updateTaskForAgent,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the Tasks module's operations against the emulators, where CI cannot, since what they guard
  is in their SQL conditions and what they find is Postgres' own pattern matching:

    bun run check:tasks-module

  It makes two throwaway organizations with a member, one for the board and one filled to its cap,
  calls the backend connector's own operations as the module calls them, and the web connector's as
  a member, removes everything it made, then exits non-zero naming each check that failed. The
  module's tests run against a fake of these operations: this is what says the fake's conditions are
  the SQL's.

  `GetUnindexedTasks` and `IndexTaskText`, the backfill's, take no organization, so they read and
  write every unindexed task in the emulator; nothing else here reaches past the two organizations.

  Like `checkKnowledgeModule.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:tasks-module`',
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
const fullOrganizationId = createId()
const userId = `check-tasks-module-${checkId}-member`
const otherUserId = `check-tasks-module-${checkId}-other`
const scope = `connection:check-${checkId}`
const impersonate = { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } }
const HOUR_MS = 60 * 60 * 1000

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

const memberships: Record<string, string> = {}

function caller(organization = organizationId) {
  return { organizationId: organization, userId, membershipCreatedAt: memberships[organization] ?? '' }
}

type StoredTask = {
  name: string
  description: string
  descriptionText: string | null
  status: string
  position: number
  assigneeId: string | null
  isAssignedToAgent: boolean
  dueDate: string | null
  aspects: string[]
  deletedAt: string | null
  updatedAt: string
}

// A task written straight into its table, as a page would have stored it
async function insertTask(fields: Variables = {}, organization = organizationId) {
  const id = createId()

  await write(`mutation InsertTask($data: Task_Data!) { task_insert(data: $data) }`, {
    data: {
      id,
      organizationId: organization,
      name: 'Task',
      description: '',
      descriptionText: '',
      status: 'TODO',
      position: 1,
      ...fields,
    },
  })

  return id
}

async function readTask(id: string) {
  const data = await read<{ task: StoredTask | null }>(
    `query ReadTask($id: UUID!) {
      task(id: $id) {
        name description descriptionText status position assigneeId isAssignedToAgent dueDate aspects deletedAt updatedAt
      }
    }`,
    { id },
  )

  return data.task
}

async function link(taskId: string, dependencyId: string) {
  await write(
    `mutation Link($taskId: UUID!, $dependencyId: UUID!) {
    taskDependency_insert(data: { taskId: $taskId, dependencyId: $dependencyId })
  }`,
    { taskId, dependencyId },
  )
}

async function setUp() {
  for (const member of [userId, otherUserId]) {
    await webConnector.executeMutation(
      'CreateCurrentUser',
      { locale: 'EN', authenticationProviders: [] },
      { impersonate: { authClaims: { sub: member, email: `${member}@example.com` } } },
    )
  }

  for (const organization of [organizationId, fullOrganizationId]) {
    await write(
      `mutation SetUp($organizationId: UUID!, $userId: String!) {
        organization_insert(data: { id: $organizationId, name: "Checked organization" })
        userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: MEMBER })
      }`,
      { organizationId: organization, userId },
    )

    const data = await read<{ userOrganization: { createdAt: string } }>(
      `query ReadMembership($organizationId: UUID!, $userId: String!) {
        userOrganization(key: { userId: $userId, organizationId: $organizationId }) { createdAt }
      }`,
      { organizationId: organization, userId },
    )

    memberships[organization] = data.userOrganization.createdAt
  }
}

async function tearDown() {
  await write(
    `mutation TearDown($organizationId: UUID!, $fullOrganizationId: UUID!, $userId: String!, $otherUserId: String!) {
      organization_delete(id: $organizationId)
      full: organization_delete(id: $fullOrganizationId)
      user_delete(id: $userId)
      other: user_delete(id: $otherUserId)
    }`,
    { organizationId, fullOrganizationId, userId, otherUserId },
  )
}

function create(fields: Variables = {}) {
  return createTaskForAgent(dataConnect, {
    ...caller(),
    id: createId(),
    name: 'Created',
    description: '',
    descriptionText: '',
    status: TaskStatus.TODO,
    position: 1,
    isAssignedToAgent: false,
    aspects: [],
    ...UNKEYED,
    ...fields,
  })
}

async function checkIdempotency() {
  const countResults = async () =>
    (
      await read<{ moduleCallResults: unknown[] }>(
        `query CountResults($scope: String!) { moduleCallResults(where: { idempotencyScope: { eq: $scope } }) { tool } }`,
        { scope },
      )
    ).moduleCallResults.length
  const countTasks = async () =>
    (
      await read<{ tasks: unknown[] }>(
        `query CountTasks($organizationId: UUID!) { tasks(where: { organizationId: { eq: $organizationId } }) { id } }`,
        { organizationId },
      )
    ).tasks.length
  const keyed = (key: string) => ({
    isKeyed: true,
    idempotencyScope: scope,
    idempotencyKey: key,
    tool: 'create_task',
    argumentsHash: 'hash',
    result: JSON.stringify({ key }),
    expiresAt: null,
  })
  const tasksBefore = await countTasks()

  await create()

  check('a write without a key inserts no call result, through @include', (await countResults()) === 0)

  await create(keyed('first-key'))

  const stored = await getModuleCallResult(dataConnect, {
    ...caller(),
    idempotencyScope: scope,
    idempotencyKey: 'first-key',
  })

  check(
    'a write with a key inserts its call result, which reads back',
    stored.data.moduleCallResult?.tool === 'create_task' && stored.data.membership.length === 1,
  )

  const again = await refusal(create(keyed('first-key')))

  check(
    'a write sent again under its key is refused on the key, and writes nothing',
    (again?.includes('module_call_result_pkey') ?? false) && (await countTasks()) === tasksBefore + 2,
  )

  const outcomes = await Promise.all([1, 2, 3].map(() => refusal(create(keyed('racing-key')))))

  check(
    'three writes at once under one key make one write',
    outcomes.filter(outcome => outcome === null).length === 1 && (await countTasks()) === tasksBefore + 3,
  )
}

async function checkCreating() {
  const outcomes = {
    lineBreak: await refusal(create({ name: 'One\nTwo' })),
    spaces: await refusal(create({ name: ' Padded' })),
    tooLong: await refusal(create({ description: 'd'.repeat(20001), descriptionText: '' })),
    aspects: await refusal(create({ aspects: ['SALES', 'SALES'] })),
    both: await refusal(create({ assigneeId: userId, isAssignedToAgent: true })),
    stranger: await refusal(create({ assigneeId: otherUserId })),
    stale: await refusal(create({ membershipCreatedAt: STALE })),
  }

  check('a name with a line break is refused', outcomes.lineBreak?.includes("A task's name") ?? false)
  check('a name with a space at an end is refused', outcomes.spaces?.includes("A task's name") ?? false)
  check('a description past 20000 characters is refused', outcomes.tooLong?.includes('at most 20000') ?? false)
  check('a repeated aspect is refused', outcomes.aspects?.includes('each aspect at most once') ?? false)
  check('a task assigned to a member and to Strategy Dance is refused', outcomes.both?.includes('not both') ?? false)
  check(
    'a task assigned to somebody outside the organization is refused',
    outcomes.stranger?.includes('a member of its organization') ?? false,
  )
  check('a caller whose membership ended is refused', outcomes.stale?.includes('no longer a member') ?? false)

  const id = createId()

  await create({
    id,
    name: 'Assigned',
    assigneeId: userId,
    descriptionText: 'brief',
    dueDate: '2026-11-01',
    aspects: ['LEGAL'],
  })

  const task = await readTask(id)

  check(
    'a created task keeps what it was written with, its plain text included',
    task?.assigneeId === userId && task.descriptionText === 'brief' && task.dueDate === '2026-11-01',
  )
}

async function checkUpdating() {
  const id = await insertTask({ name: 'Plan', dueDate: '2026-11-01', aspects: ['SALES'], assigneeId: userId })
  const board = async () => (await getTaskBoardForAgent(dataConnect, caller())).data.tasks.find(task => task.id === id)
  const update = (fields: Variables) =>
    updateTaskForAgent(dataConnect, { ...caller(), id, updatedAt: '', ...UNKEYED, ...fields })
  const read0 = await board()

  check(
    'a task read from the board keeps its updatedAt to the microsecond, which an update matches',
    (await refusal(update({ updatedAt: read0?.updatedAt, name: 'Renamed' }))) === null,
  )

  const renamed = await readTask(id)

  check(
    'an update leaves every column it is not given alone',
    renamed?.name === 'Renamed'
      && renamed.dueDate === '2026-11-01'
      && renamed.assigneeId === userId
      && renamed.aspects.join() === 'SALES',
  )
  check(
    'an update guarded on a stale updatedAt is refused',
    (await refusal(update({ updatedAt: read0?.updatedAt, name: 'Stale' })))?.includes('changed or was deleted')
      ?? false,
  )

  await update({ updatedAt: renamed?.updatedAt, dueDate: null, assigneeId: null, isAssignedToAgent: true })

  const cleared = await readTask(id)

  check(
    'a null due date clears it, and an assignment to Strategy Dance takes the task off its member',
    cleared?.dueDate === null && cleared.assigneeId === null && cleared.isAssignedToAgent,
  )

  await update({
    updatedAt: cleared?.updatedAt,
    description: '[]',
    descriptionText: 'written',
    status: TaskStatus.DONE,
    position: 7,
  })

  const moved = await readTask(id)

  check(
    'a description is written with its plain text, a move with its column and place',
    moved?.descriptionText === 'written' && moved.status === 'DONE' && moved.position === 7,
  )
  check(
    'an assignment to a member and to Strategy Dance at once is refused',
    (await refusal(update({ updatedAt: moved?.updatedAt, assigneeId: userId, isAssignedToAgent: true })))?.includes(
      'not both',
    ) ?? false,
  )
  check(
    'an assignment to somebody outside the organization is refused',
    (
      await refusal(update({ updatedAt: moved?.updatedAt, assigneeId: otherUserId, isAssignedToAgent: false }))
    )?.includes('a member of its organization') ?? false,
  )
  check(
    'a caller whose membership ended is refused',
    (await refusal(update({ updatedAt: moved?.updatedAt, name: 'x', membershipCreatedAt: STALE })))?.includes(
      'no longer a member',
    ) ?? false,
  )
}

async function checkLinking() {
  const [a, b, c] = [await insertTask({ name: 'A' }), await insertTask({ name: 'B' }), await insertTask({ name: 'C' })]
  const add = (taskId: string, dependencyId: string) =>
    addTaskDependencyForAgent(dataConnect, { ...caller(), taskId, dependencyId, ...UNKEYED })
  const remove = (taskId: string, dependencyId: string) =>
    removeTaskDependencyForAgent(dataConnect, { ...caller(), taskId, dependencyId, ...UNKEYED })

  check('a task waiting on itself is refused', (await refusal(add(a, a)))?.includes('itself') ?? false)
  check('a link goes through', (await refusal(add(a, b))) === null)
  check('the same link again changes nothing and goes through', (await refusal(add(a, b))) === null)
  check('a link both ways is refused', (await refusal(add(b, a)))?.includes('waits on it') ?? false)

  const gone = await insertTask({ name: 'Gone', deletedAt: new Date().toISOString() })

  check('a link to a deleted task is refused', (await refusal(add(c, gone)))?.includes('No task by that id') ?? false)

  const full = await insertTask({ name: 'Full' })

  await link(full, gone)

  for (let index = 0; index < 49; index++) await link(full, await insertTask({ name: `Other ${index}` }))

  check(
    'a 51st link is refused, those to deleted tasks counted',
    (await refusal(add(full, c)))?.includes('at most 50') ?? false,
  )
  check(
    'removing a link that is not there is refused',
    (await refusal(remove(c, a)))?.includes('does not wait') ?? false,
  )
  check('removing a link to a deleted task goes through', (await refusal(remove(full, gone))) === null)

  const staleRemove = removeTaskDependencyForAgent(dataConnect, {
    ...caller(),
    membershipCreatedAt: STALE,
    taskId: a,
    dependencyId: b,
    ...UNKEYED,
  })

  check(
    'a caller whose membership ended is refused an unlink',
    (await refusal(staleRemove))?.includes('no longer a member') ?? false,
  )

  const { data } = await getTaskForAgent(dataConnect, { ...caller(), id: a })

  check(
    "a task's links read both ways, among live tasks",
    data.tasks[0]?.dependencies.map(({ dependencyId }) => dependencyId).join() === b,
  )
}

async function checkDeletingAndRestoring() {
  const old = await insertTask({ name: 'Old', deletedAt: new Date(Date.now() - 25 * HOUR_MS).toISOString() })
  const recent = await insertTask({ name: 'Recent', deletedAt: new Date(Date.now() - HOUR_MS).toISOString() })
  const live = await insertTask({ name: 'Live' })
  const remove = (id: string) => deleteTaskForAgent(dataConnect, { ...caller(), id, ...UNKEYED })
  const restore = (id: string, organization = organizationId) =>
    restoreTaskForAgent(dataConnect, { ...caller(organization), id, ...UNKEYED })

  check(
    'a task deleted over a day ago is refused a restore',
    (await refusal(restore(old)))?.includes('gone for good') ?? false,
  )

  const webRefusal = await refusal(
    webConnector.executeMutation('RestoreTask', { organizationId, id: old }, impersonate),
  )

  check("the page's restore refuses it too", webRefusal?.includes('gone for good') ?? false)
  check('a task deleted an hour ago is restored', (await refusal(restore(recent))) === null)
  check('a task not deleted is refused a restore', (await refusal(restore(live)))?.includes('gone for good') ?? false)
  const staleDelete = deleteTaskForAgent(dataConnect, { ...caller(), membershipCreatedAt: STALE, id: live, ...UNKEYED })

  check(
    'a caller whose membership ended is refused a delete',
    (await refusal(staleDelete))?.includes('no longer a member') ?? false,
  )
  check('a live task is deleted', (await refusal(remove(live))) === null)
  check('a task deleted already is refused', (await refusal(remove(live)))?.includes('No task by that id') ?? false)
  check(
    'a delete prunes the tasks deleted over a day ago',
    (await readTask(old)) === null && (await readTask(live)) !== null,
  )

  // The other organization, filled to the cap, for the restore's count and two creates at once
  const fullCaller = caller(fullOrganizationId)
  const rows = Array.from({ length: 999 }, (_, index) => ({
    organizationId: fullOrganizationId,
    name: `Task ${index}`,
    description: '',
    descriptionText: '',
    status: 'TODO',
    position: index,
  }))

  // A list holds at most 100 rows
  for (let start = 0; start < rows.length; start += 100) {
    await write(`mutation Fill($rows: [Task_Data!]!) { task_insertMany(data: $rows) }`, {
      rows: rows.slice(start, start + 100),
    })
  }

  const outcomes = await Promise.all(
    [1, 2].map(() =>
      refusal(
        createTaskForAgent(dataConnect, {
          ...fullCaller,
          id: createId(),
          name: 'Racing',
          description: '',
          descriptionText: '',
          status: TaskStatus.TODO,
          position: 1000,
          isAssignedToAgent: false,
          aspects: [],
          ...UNKEYED,
        }),
      ),
    ),
  )

  check(
    'two creates at once on a board of 999 make one task',
    outcomes.filter(outcome => outcome === null).length === 1
      && outcomes.some(outcome => outcome?.includes('at most 1000') ?? false),
  )

  const deleted = await insertTask({ name: 'Deleted', deletedAt: new Date().toISOString() }, fullOrganizationId)

  check(
    'a restore at the cap is refused',
    (await refusal(restore(deleted, fullOrganizationId)))?.includes('at most 1000') ?? false,
  )
}

async function checkIndexing() {
  const id = await insertTask({ name: 'Unindexed', description: '[]', descriptionText: null })
  const { data } = await getUnindexedTasksForAgent(dataConnect, caller())
  const row = data.tasks.find(task => task.id === id)
  const { data: written } = await indexTaskTextForAgent(dataConnect, {
    ...caller(),
    id,
    updatedAt: row?.updatedAt ?? '',
    descriptionText: 'indexed',
  })
  const indexed = await readTask(id)

  check(
    'a task not indexed is read, and indexed at the updatedAt read, which it does not move',
    written.task_updateMany === 1 && indexed?.descriptionText === 'indexed' && indexed.updatedAt === row?.updatedAt,
  )

  const saved = await insertTask({ name: 'Saved meanwhile', description: '[]', descriptionText: null })
  const { data: again } = await getUnindexedTasksForAgent(dataConnect, caller())
  const savedRow = again.tasks.find(task => task.id === saved)

  await webConnector.executeMutation(
    'UpdateTaskDescription',
    { organizationId, id: saved, description: '' },
    impersonate,
  )

  const { data: lost } = await indexTaskTextForAgent(dataConnect, {
    ...caller(),
    id: saved,
    updatedAt: savedRow?.updatedAt ?? '',
    descriptionText: 'stale',
  })

  check(
    'an index loses to a save between its read and its write, leaving the task unindexed',
    lost.task_updateMany === 0 && (await readTask(saved))?.descriptionText === null,
  )

  const { data: backfillRows } = await getUnindexedTasks(dataConnect, { skippedIds: [] })
  const backfillRow = backfillRows.tasks.find(task => task.id === saved)
  const { data: backfilled } = await indexTaskText(dataConnect, {
    id: saved,
    updatedAt: backfillRow?.updatedAt ?? '',
    descriptionText: '',
  })

  check('the backfill indexes it at the updatedAt it read', backfilled.task_updateMany === 1)
}

async function checkSearch() {
  const named = await insertTask({ name: 'Launch the Newsletter' })
  const described = await insertTask({
    name: 'Other',
    description: JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: 'draft the newsletter' }] }]),
    descriptionText: 'draft the newsletter',
  })
  const percent = await insertTask({ name: 'Grow 10% a month' })
  const underscore = await insertTask({ name: 'Rename snake_case keys' })
  const backslash = await insertTask({ name: 'Fix C:\\temp paths' })

  await insertTask({ name: 'Grow 10 a month' })
  await insertTask({ name: 'Rename snakeXcase keys' })

  const search = async (text: string) => {
    const { data } = await searchTasksForAgent(dataConnect, {
      ...caller(),
      pattern: `%${text.replace(/[\\%_]/g, character => `\\${character}`)}%`,
    })

    return data.tasks.map(({ id }) => id).sort()
  }

  check(
    'a query is found in a name and in a plain text, whatever its case',
    (await search('NEWSLETTER')).join() === [named, described].sort().join(),
  )
  check('% matches only itself', (await search('10%')).join() === percent)
  check('_ matches only itself', (await search('snake_case')).join() === underscore)
  check('\\ matches only itself', (await search(':\\temp')).join() === backslash)
  check(
    "a description's stored structure is never matched",
    (await search('type')).length === 0 && (await search('text')).length === 0,
  )

  const { data } = await searchTasksForAgent(dataConnect, {
    ...caller(),
    membershipCreatedAt: STALE,
    pattern: '%newsletter%',
  })

  check(
    'a caller whose membership ended reads no membership and no task',
    data.membership.length === 0 && data.tasks.length === 0,
  )
}

async function checkPageWrites() {
  const create = async (operation: string, fields: Variables) => {
    const id = createId()

    await webConnector.executeMutation(
      operation,
      {
        organizationId,
        id,
        name: 'From the page',
        description: '',
        status: 'TODO',
        position: 1,
        assigneeId: null,
        isAssignedToAgent: false,
        dueDate: null,
        aspects: [],
        ...fields,
      },
      impersonate,
    )

    return id
  }
  const withText = await create('CreateTaskWithText', { descriptionText: 'typed text' })

  check('a page creates a task with its plain text', (await readTask(withText))?.descriptionText === 'typed text')

  const withoutText = await create('CreateTask', {})

  check('a create from an old page leaves the plain text null', (await readTask(withoutText))?.descriptionText === null)

  await webConnector.executeMutation(
    'UpdateTaskDescriptionWithText',
    { organizationId, id: withoutText, description: '', descriptionText: 'saved' },
    impersonate,
  )

  check('a description save writes its plain text', (await readTask(withoutText))?.descriptionText === 'saved')

  await webConnector.executeMutation(
    'UpdateTaskDescription',
    { organizationId, id: withoutText, description: '' },
    impersonate,
  )

  check('a save from an old page leaves the plain text null', (await readTask(withoutText))?.descriptionText === null)
}

try {
  await setUp()
  await checkIdempotency()
  await checkCreating()
  await checkUpdating()
  await checkLinking()
  await checkDeletingAndRestoring()
  await checkIndexing()
  await checkSearch()
  await checkPageWrites()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')

process.exit(0)
