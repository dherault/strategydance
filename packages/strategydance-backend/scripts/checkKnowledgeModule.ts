import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  connectorConfig,
  createDocumentForAgent,
  deleteExpiredDocuments,
  deleteExpiredModuleCallResults,
  foldDocumentForAgent,
  getDocumentAccessForAgent,
  getDocumentForAgent,
  getDocumentSearchCorpusForAgent,
  getModuleCallResult,
  getUnindexedDocumentsForAgent,
  indexDocumentTextForAgent,
  listDocumentsForAgent,
  renameDocumentForAgent,
  restoreDocumentForAgent,
  searchDocumentsBySubstringForAgent,
  searchDocumentsForAgent,
  seedDocumentStateForAgent,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

import buildSubstringSearchPatterns from '~domain/conversations/buildSubstringSearchPatterns'

/*
  Checks the Knowledge module's operations against the emulators, where CI cannot, since what they
  guard is in their SQL conditions and what they find is Postgres' full-text search:

    bun run check:knowledge-module

  It makes a throwaway organization with a member and a few documents, calls the backend
  connector's own operations as the module calls them, and the web connector's as a member,
  removes everything it made, then exits non-zero naming each check that failed. The module's tests
  run against a fake of these operations: this is what says the fake's conditions and matches are
  the SQL's.

  The sweep's deletes take no organization: they remove every document in the emulator deleted over
  a day ago and every module call result past its expiry.

  Like `checkConversationSearch.ts`, it refuses to run unless it points at the emulator
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
const userId = `check-knowledge-module-${checkId}-member`
const scope = `connection:check-${checkId}`

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

let membershipCreatedAt = ''

function caller() {
  return { organizationId, userId, membershipCreatedAt }
}

// A document written straight into its table, as a page would have stored it
async function insertDocument(fields: Variables) {
  const id = createId()

  await write(`mutation InsertDocument($data: Document_Data!) { document_insert(data: $data) }`, {
    data: { id, organizationId, title: '', content: '', contentText: '', ...fields },
  })

  return id
}

async function readDocument(id: string) {
  const data = await read<{
    document: {
      title: string
      contentText: string | null
      revision: number
      deletedAt: string | null
      state: string | null
    } | null
  }>(`query ReadDocument($id: UUID!) { document(id: $id) { title contentText revision deletedAt state } }`, { id })

  return data.document
}

async function setUp() {
  await webConnector.executeMutation(
    'CreateCurrentUser',
    { locale: 'EN', authenticationProviders: [] },
    { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } },
  )
  await write(
    `mutation SetUp($organizationId: UUID!, $userId: String!) {
      organization_insert(data: { id: $organizationId, name: "Checked organization" })
      userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: MEMBER })
    }`,
    { organizationId, userId },
  )

  const data = await read<{ userOrganization: { createdAt: string } }>(
    `query ReadMembership($organizationId: UUID!, $userId: String!) {
      userOrganization(key: { userId: $userId, organizationId: $organizationId }) { createdAt }
    }`,
    { organizationId, userId },
  )

  membershipCreatedAt = data.userOrganization.createdAt
}

async function tearDown() {
  await write(
    `mutation TearDown($organizationId: UUID!, $userId: String!) {
      organization_delete(id: $organizationId)
      user_delete(id: $userId)
    }`,
    { organizationId, userId },
  )
}

async function checkIdempotency() {
  const create = (key: string | null, title: string) =>
    createDocumentForAgent(dataConnect, {
      ...caller(),
      id: createId(),
      title,
      aspects: [],
      state: 'AAA=',
      content: '',
      contentText: '',
      ...(key
        ? {
            isKeyed: true,
            idempotencyScope: scope,
            idempotencyKey: key,
            tool: 'create_document',
            argumentsHash: 'hash',
            result: JSON.stringify({ title }),
            expiresAt: new Date(Date.now() - 1000).toISOString(),
          }
        : UNKEYED),
    })
  const countResults = async () =>
    (
      await read<{ moduleCallResults: unknown[] }>(
        `query CountResults($scope: String!) { moduleCallResults(where: { idempotencyScope: { eq: $scope } }) { tool } }`,
        { scope },
      )
    ).moduleCallResults.length
  const countDocuments = async () =>
    (
      await read<{ documents: unknown[] }>(
        `query CountDocuments($organizationId: UUID!) { documents(where: { organizationId: { eq: $organizationId } }) { id } }`,
        { organizationId },
      )
    ).documents.length

  const documentsBefore = await countDocuments()

  await create(null, 'Unkeyed')

  check('a write without a key inserts no call result, through @include', (await countResults()) === 0)

  await create('first-key', 'Keyed')

  const stored = await getModuleCallResult(dataConnect, { idempotencyScope: scope, idempotencyKey: 'first-key' })

  check(
    'a write with a key inserts its call result, which reads back',
    stored.data.moduleCallResult?.tool === 'create_document'
      && stored.data.moduleCallResult.result === JSON.stringify({ title: 'Keyed' }),
  )

  const again = await refusal(create('first-key', 'Again'))

  check(
    'a write sent again under its key is refused on the key, and writes nothing',
    (again?.includes('module_call_result_pkey') ?? false) && (await countDocuments()) === documentsBefore + 2,
  )

  const outcomes = await Promise.all([1, 2, 3].map(() => refusal(create('racing-key', 'Racing'))))

  check(
    'three writes at once under one key make one write',
    outcomes.filter(outcome => outcome === null).length === 1 && (await countDocuments()) === documentsBefore + 3,
  )

  const { data: swept } = await deleteExpiredModuleCallResults(dataConnect)

  check('the sweep deletes the call results past their expiry', swept.moduleCallResult_deleteMany >= 2)
}

async function checkFolds() {
  const id = await insertDocument({ title: 'Folded', state: 'AAA=', content: '[]', revision: 3 })
  const fold = (fields: Variables) =>
    foldDocumentForAgent(dataConnect, {
      ...caller(),
      id,
      revision: 3,
      state: 'BBB=',
      content: '',
      contentText: 'folded',
      updateIds: [],
      isWholeReplacement: false,
      ...UNKEYED,
      ...fields,
    })

  check(
    'a fold over a revision that moved is refused',
    (await refusal(fold({ revision: 2 })))?.includes('folded, deleted or closed to agents') ?? false,
  )

  const pendingId = createId()

  await write(
    `mutation Push($documentId: UUID!, $id: UUID!) { documentUpdate_insert(data: { documentId: $documentId, id: $id, payload: "AAA=" }) }`,
    { documentId: id, id: pendingId },
  )

  check(
    'a whole text replaced is refused while an update it did not merge is pending',
    (await refusal(fold({ isWholeReplacement: true })))?.includes('edited since it was read') ?? false,
  )

  await fold({ title: 'Retitled' })

  const folded = await readDocument(id)
  const { data: pending } = await getDocumentForAgent(dataConnect, { ...caller(), id })

  check(
    'any other fold goes through, moves the revision, writes the text and the title, and leaves the push pending',
    folded?.revision === 4
      && folded.contentText === 'folded'
      && folded.title === 'Retitled'
      && pending.documents[0]?.documentUpdates_on_document.length === 1,
  )

  await fold({ revision: 4, updateIds: [pendingId] })

  const { data: merged } = await getDocumentForAgent(dataConnect, { ...caller(), id })

  check(
    'a fold leaves the title alone when it names none, and deletes the updates it merged',
    (await readDocument(id))?.title === 'Retitled' && merged.documents[0]?.documentUpdates_on_document.length === 0,
  )

  await write(`mutation Close($id: UUID!) { document_update(id: $id, data: { isAiWritable: false }) }`, { id })

  check(
    'a fold of a document closed to agents is refused',
    (await refusal(fold({ revision: 5 })))?.includes('folded, deleted or closed to agents') ?? false,
  )
  check(
    'a rename of a document closed to agents is refused',
    (await refusal(renameDocumentForAgent(dataConnect, { ...caller(), id, title: 'No', ...UNKEYED })))?.includes(
      'closed to agents',
    ) ?? false,
  )
  check(
    'a fold by a membership other than the one read is refused',
    (await refusal(fold({ revision: 5, membershipCreatedAt: '2020-01-01T00:00:00Z' })))?.includes(
      'folded, deleted or closed to agents',
    ) ?? false,
  )

  const access = await getDocumentAccessForAgent(dataConnect, { ...caller(), id })
  const stranger = await getDocumentAccessForAgent(dataConnect, {
    ...caller(),
    membershipCreatedAt: '2020-01-01T00:00:00Z',
    id,
  })

  check(
    'the access read says what agents may do, and finds no membership but the one read',
    access.data.documents[0]?.isAiWritable === false
      && access.data.membership.length === 1
      && stranger.data.membership.length === 0,
  )
}

async function checkSeeding() {
  const id = await insertDocument({ title: 'Unshared', state: null, content: '[]', revision: 0 })
  const seed = () => seedDocumentStateForAgent(dataConnect, { ...caller(), id, state: 'AAA=', revision: 0 })

  check('a document with no snapshot is seeded', (await refusal(seed())) === null)
  check(
    'a second seed at the same revision is refused',
    (await refusal(seed()))?.includes('seeded or changed elsewhere') ?? false,
  )
}

async function checkSearch() {
  const both = await insertDocument({
    title: 'Quarterly marketing plan',
    contentText: 'We grow through partnerships',
    aspects: ['MARKETING', 'SALES'],
  })
  const kept = await insertDocument({
    title: 'Marketing secrets',
    contentText: 'partnerships',
    isAiReadable: false,
  })
  const search = (query: string, aspects: string[] = []) =>
    searchDocumentsForAgent(dataConnect, { ...caller(), query, aspects: aspects as never }).then(({ data }) =>
      data.documents_search.map(document => document.id),
    )

  check(
    'a search finds every word across the title and the text',
    (await search('MARKETING partnerships')).includes(both),
  )
  check('a search never finds a document kept from agents', !(await search('marketing partnerships')).includes(kept))
  check('a search needs every word', (await search('marketing absent')).length === 0)
  check('no aspect named finds any document', (await search('quarterly')).includes(both))
  check(
    'aspects named find the documents tagged with every one',
    (await search('quarterly', ['SALES', 'MARKETING'])).includes(both)
      && !(await search('quarterly', ['SALES', 'LEGAL'])).includes(both),
  )

  const chinese = await insertDocument({ title: '计划', contentText: '我们计划下个月推出新产品。' })
  const { data: corpus } = await getDocumentSearchCorpusForAgent(dataConnect, { ...caller(), aspects: [] })
  const bySubstring = async (terms: string[], recentIds: string[]) =>
    (
      await searchDocumentsBySubstringForAgent(dataConnect, {
        ...caller(),
        aspects: [],
        recentIds,
        ...buildSubstringSearchPatterns(terms),
      })
    ).data.documents.map(document => document.id)

  check(
    'the corpus is the latest documents agents may read',
    corpus.documents.some(document => document.id === chinese)
      && !corpus.documents.some(document => document.id === kept),
  )
  check(
    'a substring search finds a word inside a sentence among the recent documents',
    (await bySubstring(['推出'], [chinese])).includes(chinese),
  )
  check(
    'a substring search reads the text of the recent documents alone, and every title',
    !(await bySubstring(['推出'], [])).includes(chinese) && (await bySubstring(['计划'], [])).includes(chinese),
  )
  check('a substring escapes LIKE wildcards', (await bySubstring(['%'], [chinese])).length === 0)
  check(
    'a substring search takes each word from the title or the text',
    (await bySubstring(['计划', '推出'], [chinese])).includes(chinese)
      && !(await bySubstring(['计划', '推出'], [])).includes(chinese),
  )
}

async function checkIndexing() {
  const id = await insertDocument({ title: 'Unindexed', contentText: null, revision: 2, content: '[]' })
  const { data: unindexed } = await getUnindexedDocumentsForAgent(dataConnect, caller())

  check(
    'the unindexed documents read with the membership',
    unindexed.membership.length === 1 && unindexed.documents.some(document => document.id === id),
  )

  const stale = await indexDocumentTextForAgent(dataConnect, { ...caller(), id, revision: 1, contentText: 'stale' })

  check(
    'an index at a revision that moved writes nothing',
    stale.data.document_updateMany === 0 && (await readDocument(id))?.contentText === null,
  )

  const fresh = await indexDocumentTextForAgent(dataConnect, { ...caller(), id, revision: 2, contentText: 'fresh' })

  check('an index at the revision read writes the text', fresh.data.document_updateMany === 1)
  check(
    'an index of a document indexed already writes nothing',
    (await indexDocumentTextForAgent(dataConnect, { ...caller(), id, revision: 2, contentText: 'again' })).data
      .document_updateMany === 0 && (await readDocument(id))?.contentText === 'fresh',
  )
}

async function checkListing() {
  const instant = '2026-10-01T12:00:00.123456Z'
  const tied = [await insertDocument({ title: 'Tied A' }), await insertDocument({ title: 'Tied B' })]

  for (const id of tied) {
    await write(`mutation Tie($id: UUID!, $at: Timestamp!) { document_update(id: $id, data: { updatedAt: $at }) }`, {
      id,
      at: instant,
    })
  }

  const { data } = await listDocumentsForAgent(dataConnect, { ...caller(), aspects: [], before: instant })
  const { data: first } = await listDocumentsForAgent(dataConnect, {
    ...caller(),
    aspects: [],
    before: '9999-12-31T23:59:59.999999Z',
  })
  const tiedIds = data.atCursor.map(document => document.id)

  check(
    'a page reads every document changed at the cursor’s instant, by id, and those before it apart',
    tied.every(id => tiedIds.includes(id))
      && tiedIds.every((id, index) => index === 0 || tiedIds[index - 1]! < id)
      && !data.beforeCursor.some(document => tied.includes(document.id)),
  )
  check(
    'an instant read back matches itself, to the microsecond',
    data.atCursor.every(document => document.updatedAt === instant),
  )
  check(
    'the first page reads every document before the end of time',
    first.atCursor.length === 0 && tied.every(id => first.beforeCursor.some(document => document.id === id)),
  )
}

async function checkRestoring() {
  const recent = await insertDocument({
    title: 'Recent',
    deletedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  })
  const old = await insertDocument({
    title: 'Old',
    deletedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  })
  const restore = (id: string) => restoreDocumentForAgent(dataConnect, { ...caller(), id, ...UNKEYED })

  check('a document deleted an hour ago is restored', (await refusal(restore(recent))) === null)
  check(
    'a document deleted over a day ago is refused',
    (await refusal(restore(old)))?.includes('gone for good') ?? false,
  )

  const webRefusal = await refusal(
    webConnector.executeMutation(
      'RestoreDocument',
      { organizationId, id: old },
      { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } },
    ),
  )

  check('the page’s restore refuses it too', webRefusal?.includes('gone for good') ?? false)

  const { data: swept } = await deleteExpiredDocuments(dataConnect)

  check(
    'the sweep deletes the documents deleted over a day ago, and keeps the rest',
    swept.document_deleteMany >= 1 && (await readDocument(old)) === null && (await readDocument(recent)) !== null,
  )
}

async function checkPageWrites() {
  const id = createId()
  const impersonate = { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } }

  await webConnector.executeMutation(
    'CreateDocumentWithText',
    {
      organizationId,
      id,
      title: 'From the page',
      content: '',
      contentText: 'typed text',
      aspects: [],
      isAiReadable: true,
      isAiWritable: true,
      state: 'AAA=',
    },
    impersonate,
  )

  check('a page creates a document with its plain text', (await readDocument(id))?.contentText === 'typed text')

  await webConnector.executeMutation(
    'CompactDocument',
    { organizationId, id, state: 'BBB=', content: '', revision: 0, updateIds: [] },
    impersonate,
  )

  check('a compaction from an old page leaves the plain text null', (await readDocument(id))?.contentText === null)

  await webConnector.executeMutation(
    'CompactDocumentWithText',
    { organizationId, id, state: 'CCC=', content: '', contentText: 'compacted', revision: 1, updateIds: [] },
    impersonate,
  )

  check('a compaction writes the plain text', (await readDocument(id))?.contentText === 'compacted')
}

try {
  await setUp()
  await checkIdempotency()
  await checkFolds()
  await checkSeeding()
  await checkSearch()
  await checkIndexing()
  await checkListing()
  await checkRestoring()
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
