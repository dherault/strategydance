import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  allowOrganizationIntegrationTool,
  cancelIntegrationAuthorization,
  changeOrganizationIntegrationIssuer,
  claimIntegrationConnectionRefresh,
  connectIntegration,
  connectorConfig,
  consumeIntegrationAuthorization,
  createOrganizationIntegration,
  deleteIntegrationAuthorizationByState,
  deleteOrganizationIntegration,
  disallowOrganizationIntegrationTool,
  disconnectIntegration,
  forgetOrganizationIntegrationOAuthClient,
  getIntegrationAuthorizationByState,
  getOrganizationIntegrationForAdministrator,
  IntegrationApiKeyScheme,
  IntegrationAuthentication,
  IntegrationError,
  markIntegrationConnectionNeedsAuthentication,
  markIntegrationConnectionTokenRefused,
  pruneDeletedIntegrations,
  pruneIntegrationAuthorizations,
  receiveIntegrationAuthorizationCode,
  reconfigureOrganizationIntegration,
  recordFirstIntegrationTools,
  recordIntegrationConnectionTokens,
  recordOrganizationIntegrationError,
  recordOrganizationIntegrationIssuer,
  recordOrganizationIntegrationOAuthClient,
  recordOrganizationIntegrationTools,
  releaseIntegrationConnectionRefresh,
  renameOrganizationIntegration,
  restoreOrganizationIntegration,
  setOrganizationIntegrationEnabled,
  startIntegrationAuthorization,
  updateOrganizationIntegrationKey,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the integrations' operations against the emulators, where CI cannot, since what they guard
  is in their SQL conditions:

    bun run check:integrations

  It makes two throwaway organizations, one administered by the checked account and one it is a
  member of, calls the backend connector's operations as the integrations' routes call them, members'
  connections and Connects included, and the web connector's live queries as a member and as
  somebody outside, removes everything it made, then exits non-zero naming each check that failed. The routes' tests run against a fake of these
  operations: this is what says the fake's conditions are the SQL's.

  Like `checkTasksModule.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:integrations`',
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
const administratorId = `check-integrations-${checkId}-administrator`
const memberId = `check-integrations-${checkId}-member`
const outsiderId = `check-integrations-${checkId}-outsider`
const DAY_MS = 24 * 60 * 60 * 1000

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

function as(userId: string) {
  return { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } }
}

const administrator = { organizationId, userId: administratorId }

type StoredIntegration = {
  name: string
  url: string
  catalogueSlug: string | null
  authentication: string
  isEnabled: boolean
  configRevision: number
  encryptedApiKey: string | null
  keyGeneration: number
  apiKeyScheme: string
  apiKeyHeader: string | null
  issuer: string | null
  tools: string | null
  toolCount: number | null
  toolDefinitionHashes: string[]
  autoApprovedTools: string[]
  lastError: string | null
  deletedAt: string | null
}

async function readIntegration(id: string) {
  const data = await read<{ organizationIntegration: StoredIntegration | null }>(
    `query ReadIntegration($id: UUID!) {
      organizationIntegration(id: $id) {
        name url catalogueSlug authentication isEnabled configRevision encryptedApiKey keyGeneration apiKeyScheme apiKeyHeader
        issuer tools toolCount toolDefinitionHashes autoApprovedTools lastError deletedAt
      }
    }`,
    { id },
  )

  return data.organizationIntegration
}

// A server written straight into its table, as an earlier add would have stored it
async function insertIntegration(fields: Variables = {}, organization = organizationId) {
  const id = createId()
  const name = `Inserted ${id.slice(0, 6)}`

  await write(
    `mutation InsertIntegration($data: OrganizationIntegration_Data!) { organizationIntegration_insert(data: $data) }`,
    {
      data: {
        id,
        organizationId: organization,
        name,
        normalizedName: name.toLowerCase(),
        url: 'https://mcp.example.com/mcp',
        authentication: 'NONE',
        ...fields,
      },
    },
  )

  return id
}

function create(fields: Variables = {}) {
  const name = (fields.name as string | undefined) ?? `Server ${createId().slice(0, 6)}`

  return createOrganizationIntegration(dataConnect, {
    ...administrator,
    integrationId: createId(),
    name,
    normalizedName: name.trim().toLowerCase(),
    url: 'https://mcp.example.com/mcp',
    authentication: IntegrationAuthentication.API_KEY,
    encryptedApiKey: 'v1:local:ciphertext',
    apiKeyLastFour: 'abcd',
    apiKeyScheme: IntegrationApiKeyScheme.BEARER,
    tools: '[]',
    toolCount: 0,
    toolDefinitionHashes: [],
    ...fields,
  })
}

async function setUp() {
  for (const userId of [administratorId, memberId, outsiderId]) {
    await webConnector.executeMutation('CreateCurrentUser', { locale: 'EN', authenticationProviders: [] }, as(userId))
  }

  await write(
    `mutation SetUp($organizationId: UUID!, $otherOrganizationId: UUID!, $administratorId: String!, $memberId: String!) {
      organization_insert(data: { id: $organizationId, name: "Checked organization" })
      other: organization_insert(data: { id: $otherOrganizationId, name: "Other organization" })
      userOrganization_insert(data: { userId: $administratorId, organizationId: $organizationId, role: ADMINISTRATOR })
      member: userOrganization_insert(data: { userId: $memberId, organizationId: $organizationId, role: MEMBER })
      elsewhere: userOrganization_insert(data: { userId: $administratorId, organizationId: $otherOrganizationId, role: MEMBER })
    }`,
    { organizationId, otherOrganizationId, administratorId, memberId },
  )
}

async function tearDown() {
  await write(
    `mutation TearDown($organizationId: UUID!, $otherOrganizationId: UUID!, $administratorId: String!, $memberId: String!, $outsiderId: String!) {
      organization_delete(id: $organizationId)
      other: organization_delete(id: $otherOrganizationId)
      user_delete(id: $administratorId)
      member: user_delete(id: $memberId)
      outsider: user_delete(id: $outsiderId)
    }`,
    { organizationId, otherOrganizationId, administratorId, memberId, outsiderId },
  )
}

async function checkCreating() {
  const integrationId = createId()
  const created = await refusal(create({ integrationId, name: 'Notion' }))

  check('an administrator adds a server under the id the backend made', created === null)
  check('the server keeps what it was added with', (await readIntegration(integrationId))?.apiKeyScheme === 'BEARER')
  check(
    'a member who does not administer the organization is refused',
    await isRefused(create({ userId: memberId }), 'Only an administrator can add a server'),
  )
  check(
    'somebody outside the organization is refused',
    await isRefused(create({ userId: outsiderId }), 'can add a server'),
  )
  check(
    'a name another server holds is refused, whatever its case',
    await isRefused(create({ name: ' NOTION ' }), 'Another server of the organization has this name'),
  )

  const deletedId = await insertIntegration({
    name: 'Linear',
    normalizedName: 'linear',
    deletedAt: new Date().toISOString(),
  })

  check('a deleted server keeps no name', (await refusal(create({ name: 'Linear' }))) === null)
  check('nor counts', (await readIntegration(deletedId))?.deletedAt !== null)
}

async function checkTheLimit() {
  const live = await read<{ organizationIntegrations: unknown[] }>(
    `query CountLive($organizationId: UUID!) {
      organizationIntegrations(where: { organizationId: { eq: $organizationId }, deletedAt: { isNull: true } }) { id }
    }`,
    { organizationId },
  )

  for (let count = live.organizationIntegrations.length; count < 50; count++) await insertIntegration()

  check('an organization adds at most 50 servers', await isRefused(create(), 'An organization adds at most 50 servers'))

  await write(
    `mutation DeleteDirectly($organizationId: UUID!) {
      organizationIntegration_deleteMany(where: { organizationId: { eq: $organizationId }, name: { startsWith: "Inserted" } })
    }`,
    { organizationId },
  )
}

async function checkTheLiveList() {
  const listed = await webConnector.executeQuery<{ organizationIntegrations: { name: string }[] }, Variables>(
    'GetOrganizationIntegrations',
    { organizationId },
    as(memberId),
  )

  check(
    'a member reads the live servers',
    listed.data.organizationIntegrations.some(({ name }) => name === 'Notion'),
  )
  check(
    'and never a deleted one',
    !listed.data.organizationIntegrations.some(({ name }) => name.startsWith('Inserted')),
  )

  const outside = await webConnector.executeQuery<{ organizationIntegrations: unknown[] }, Variables>(
    'GetOrganizationIntegrations',
    { organizationId },
    as(outsiderId),
  )

  check('somebody outside reads nothing', outside.data.organizationIntegrations.length === 0)
}

async function checkRenaming() {
  const id = createId()

  await create({ integrationId: id, name: 'Sentry' })

  const rename = (name: string, readName: string, userId = administratorId) =>
    renameOrganizationIntegration(dataConnect, {
      organizationId,
      userId,
      integrationId: id,
      name,
      normalizedName: name.trim().toLowerCase(),
      readName,
    })

  check(
    'a rename made over another made meanwhile is refused',
    await isRefused(rename('Errors', 'Not its name'), 'The server was changed or deleted meanwhile'),
  )
  check('a server keeps its own name in another case', (await refusal(rename('SENTRY', 'Sentry'))) === null)
  check(
    "a server cannot take another's name",
    await isRefused(rename('notion', 'SENTRY'), 'Another server of the organization has this name'),
  )
  check(
    'a member cannot rename one',
    await isRefused(rename('Errors', 'SENTRY', memberId), 'Only an administrator can change a server'),
  )
}

async function checkReconfiguring() {
  const id = createId()
  const hashes = ['hash-a', 'hash-b']

  const createdName = 'Reconfigured'

  await create({ integrationId: id, name: createdName, catalogueSlug: 'github', toolDefinitionHashes: hashes })
  await allowOrganizationIntegrationTool(dataConnect, {
    ...administrator,
    integrationId: id,
    definitionHash: 'hash-a',
    configRevision: 0,
  })

  const reconfigure = (configRevision: number, keyGeneration: number, readName = createdName) =>
    reconfigureOrganizationIntegration(dataConnect, {
      ...administrator,
      integrationId: id,
      name: 'Moved',
      normalizedName: 'moved',
      readName,
      configRevision,
      keyGeneration,
      url: 'https://mcp.elsewhere.example/mcp',
      catalogueSlug: null,
      authentication: IntegrationAuthentication.OAUTH,
      encryptedApiKey: null,
      apiKeyLastFour: null,
      apiKeyScheme: IntegrationApiKeyScheme.BEARER,
      apiKeyHeader: null,
      issuer: 'https://auth.elsewhere.example',
      tools: null,
      toolCount: null,
      toolDefinitionHashes: [],
    })

  check(
    'a change made from a configuration read before another is refused',
    await isRefused(reconfigure(1, 0), 'The server was changed or deleted meanwhile'),
  )
  check(
    'a change made over a rename made meanwhile is refused',
    await isRefused(reconfigure(0, 0, 'Another name'), 'The server was changed or deleted meanwhile'),
  )
  check('a change made from the stored configuration goes through', (await refusal(reconfigure(0, 0))) === null)

  const stored = await readIntegration(id)

  check(
    'it clears the key, the tools and every approval given for the old server',
    stored?.encryptedApiKey === null && stored.tools === null && stored.autoApprovedTools.length === 0,
  )
  check('and bumps the revision and the generation', stored?.configRevision === 1 && stored.keyGeneration === 1)
  check('it keeps the issuer it found', stored?.issuer === 'https://auth.elsewhere.example')
  check('and the name it is given in the same write', stored?.name === 'Moved')
  check('and the external MCP server at the new address, none here', stored?.catalogueSlug === null)
  check(
    'a change taking the name another server holds is refused',
    await isRefused(
      reconfigureOrganizationIntegration(dataConnect, {
        ...administrator,
        integrationId: id,
        name: 'Notion',
        normalizedName: 'notion',
        readName: 'Moved',
        configRevision: 1,
        keyGeneration: 1,
        url: 'https://mcp.elsewhere.example/mcp',
        catalogueSlug: null,
        authentication: IntegrationAuthentication.NONE,
        encryptedApiKey: null,
        apiKeyLastFour: null,
        apiKeyScheme: IntegrationApiKeyScheme.BEARER,
        apiKeyHeader: null,
        issuer: null,
        tools: '[]',
        toolCount: 0,
        toolDefinitionHashes: [],
      }),
      'Another server of the organization has this name',
    ),
  )
}

async function checkKeysAndTools() {
  const id = createId()

  const keyedName = 'Keyed first'

  await create({ integrationId: id, name: keyedName, toolDefinitionHashes: ['hash-a', 'hash-b', 'hash-c'] })

  const allow = (definitionHash: string, configRevision = 0) =>
    allowOrganizationIntegrationTool(dataConnect, {
      ...administrator,
      integrationId: id,
      definitionHash,
      configRevision,
    })

  check(
    'a tool shown under another configuration is refused',
    await isRefused(allow('hash-a', 7), 'The server no longer lists this tool'),
  )
  check('a listed tool is allowed', (await refusal(allow('hash-a'))) === null)
  check('allowing it twice keeps it once', (await refusal(allow('hash-a'))) === null)
  await allow('hash-b')
  check(
    'a tool the server does not list is refused',
    await isRefused(allow('hash-z'), 'The server no longer lists this tool'),
  )
  check(
    'the approvals are the tools allowed',
    (await readIntegration(id))?.autoApprovedTools.join() === 'hash-a,hash-b',
  )

  await disallowOrganizationIntegrationTool(dataConnect, {
    ...administrator,
    integrationId: id,
    definitionHash: 'hash-b',
    configRevision: 0,
  })
  check('an approval is taken back', (await readIntegration(id))?.autoApprovedTools.join() === 'hash-a')
  await allow('hash-c')

  const updateKey = (keyGeneration: number) =>
    updateOrganizationIntegrationKey(dataConnect, {
      ...administrator,
      integrationId: id,
      name: 'Keyed',
      normalizedName: 'keyed',
      readName: keyedName,
      configRevision: 0,
      keyGeneration,
      configRevisionIncrement: 1,
      keyGenerationIncrement: 1,
      encryptedApiKey: 'v1:local:replaced',
      apiKeyLastFour: 'wxyz',
      apiKeyScheme: IntegrationApiKeyScheme.HEADER,
      apiKeyHeader: 'X-API-Key',
      tools: '[]',
      toolCount: 2,
      toolDefinitionHashes: ['hash-a', 'hash-d'],
      removedToolDefinitionHashes: ['hash-b', 'hash-c'],
    })

  check(
    'a key replaced from an older generation is refused',
    await isRefused(updateKey(1), 'The server was changed or deleted meanwhile'),
  )
  check('a key is replaced', (await refusal(updateKey(0))) === null)

  const replaced = await readIntegration(id)

  check(
    'it keeps the approvals of the tools still listed and drops the others',
    replaced?.autoApprovedTools.join() === 'hash-a',
  )
  check(
    'it bumps the generation and the revision by the increments given',
    replaced?.keyGeneration === 1 && replaced.configRevision === 1,
  )
  check('it keeps how the key is sent', replaced?.apiKeyHeader === 'X-API-Key' && replaced.apiKeyScheme === 'HEADER')

  const recordTools = (keyGeneration: number) =>
    recordOrganizationIntegrationTools(dataConnect, {
      ...administrator,
      integrationId: id,
      configRevision: 1,
      keyGeneration,
      tools: '[]',
      toolCount: 1,
      toolDefinitionHashes: ['hash-d'],
      removedToolDefinitionHashes: ['hash-a'],
    })

  check(
    'tools listed with a replaced key are refused',
    await isRefused(recordTools(0), 'The server was changed or deleted meanwhile'),
  )

  await recordOrganizationIntegrationError(dataConnect, {
    ...administrator,
    integrationId: id,
    configRevision: 1,
    keyGeneration: 1,
    error: IntegrationError.TIMED_OUT,
  })
  check('an error is recorded', (await readIntegration(id))?.lastError === 'TIMED_OUT')
  check('tools listed with the stored key go through', (await refusal(recordTools(1))) === null)

  const listed = await readIntegration(id)

  check(
    'and clear the error, dropping the approvals of tools no longer listed',
    listed?.lastError === null && listed.autoApprovedTools.length === 0 && listed.toolCount === 1,
  )

  const tools = await webConnector.executeQuery<{ organizationIntegrations: { tools: string | null }[] }, Variables>(
    'GetOrganizationIntegrationTools',
    { organizationId, integrationId: id },
    as(memberId),
  )

  check('a member reads the tools', tools.data.organizationIntegrations[0]?.tools === '[]')

  const outside = await webConnector.executeQuery<{ organizationIntegrations: unknown[] }, Variables>(
    'GetOrganizationIntegrationTools',
    { organizationId, integrationId: id },
    as(outsiderId),
  )

  check('somebody outside reads no tools', outside.data.organizationIntegrations.length === 0)

  const forAdministrator = await getOrganizationIntegrationForAdministrator(dataConnect, {
    organizationId,
    integrationId: id,
  })

  check(
    "the backend reads the key's ciphertext",
    forAdministrator.data.organizationIntegrations[0]?.encryptedApiKey === 'v1:local:replaced',
  )

  const elsewhere = await getOrganizationIntegrationForAdministrator(dataConnect, {
    organizationId: otherOrganizationId,
    integrationId: id,
  })

  check('but never under another organization', elsewhere.data.organizationIntegrations.length === 0)
}

async function checkIssuers() {
  const id = createId()

  await create({
    integrationId: id,
    authentication: IntegrationAuthentication.OAUTH,
    encryptedApiKey: null,
    apiKeyLastFour: null,
    issuer: 'https://auth.example.com',
    tools: null,
    toolCount: null,
  })

  const recordIssuer = (issuer: string) =>
    recordOrganizationIntegrationIssuer(dataConnect, { ...administrator, integrationId: id, configRevision: 0, issuer })

  check('the issuer held is found again', (await refusal(recordIssuer('https://auth.example.com'))) === null)
  check(
    'another issuer is not taken for it',
    await isRefused(recordIssuer('https://other.example.com'), 'The server was changed or deleted meanwhile'),
  )

  await write(
    `mutation Approve($id: UUID!) {
      organizationIntegration_update(id: $id, data: { tools: "[]", toolCount: 1, toolDefinitionHashes: ["hash-a"], autoApprovedTools: ["hash-a"] })
    }`,
    { id },
  )

  check(
    'another issuer is taken',
    (await refusal(
      changeOrganizationIntegrationIssuer(dataConnect, {
        ...administrator,
        integrationId: id,
        configRevision: 0,
        issuer: 'https://other.example.com',
      }),
    )) === null,
  )

  const changed = await readIntegration(id)

  check(
    'with every tool and approval given under the old one gone',
    changed?.issuer === 'https://other.example.com'
      && changed.tools === null
      && changed.autoApprovedTools.length === 0
      && changed.configRevision === 1,
  )
}

async function checkEnabling() {
  const id = createId()

  await create({ integrationId: id })
  await setOrganizationIntegrationEnabled(dataConnect, { ...administrator, integrationId: id, isEnabled: false })
  check('a server is turned off', (await readIntegration(id))?.isEnabled === false)
  check(
    'by an administrator alone',
    await isRefused(
      setOrganizationIntegrationEnabled(dataConnect, {
        organizationId,
        userId: memberId,
        integrationId: id,
        isEnabled: true,
      }),
      'Only an administrator can change a server',
    ),
  )
}

async function checkDeletingAndRestoring() {
  const id = createId()

  await create({ integrationId: id, name: 'Vercel' })

  const old = await insertIntegration({ deletedAt: new Date(Date.now() - 2 * DAY_MS).toISOString() })
  const delete_ = () => deleteOrganizationIntegration(dataConnect, { ...administrator, integrationId: id })
  const restore = () =>
    restoreOrganizationIntegration(dataConnect, { ...administrator, integrationId: id, normalizedName: 'vercel' })

  check('a server is deleted', (await refusal(delete_())) === null)
  check('a deleted server is not deleted again', await isRefused(delete_(), 'The server is gone'))
  check("a delete prunes the organization's servers deleted over a day ago", (await readIntegration(old)) === null)
  check('the key stays for an Undo', (await readIntegration(id))?.encryptedApiKey !== null)

  await create({ name: 'vercel' })
  check(
    'a restore is refused once another server took its name',
    await isRefused(restore(), 'Another server of the organization has this name'),
  )
  await write(
    `mutation Rename($organizationId: UUID!) {
      organizationIntegration_updateMany(where: { organizationId: { eq: $organizationId }, normalizedName: { eq: "vercel" }, deletedAt: { isNull: true } }, data: { name: "Renamed", normalizedName: "renamed" })
    }`,
    { organizationId },
  )
  check('a delete is taken back within a day', (await refusal(restore())) === null)

  const expired = await insertIntegration({ name: 'Expired', normalizedName: 'expired' })

  await write(
    `mutation Expire($id: UUID!) { organizationIntegration_update(id: $id, data: { deletedAt_time: { now: true, sub: { hours: 25 } } }) }`,
    { id: expired },
  )
  check(
    'never after',
    await isRefused(
      restoreOrganizationIntegration(dataConnect, {
        ...administrator,
        integrationId: expired,
        normalizedName: 'expired',
      }),
      'The server is gone for good',
    ),
  )

  const recent = await insertIntegration({ deletedAt: new Date().toISOString() }, otherOrganizationId)
  const pruned = await pruneDeletedIntegrations(dataConnect)

  check('the sweep prunes servers deleted over a day ago', (await readIntegration(expired)) === null)
  check('and keeps the ones deleted since', (await readIntegration(recent)) !== null)
  check('it says how many it pruned', pruned.data.organizationIntegration_deleteMany >= 1)
}

type StoredConnection = {
  generation: string
  status: string
  encryptedAccessToken: string | null
  encryptedRefreshToken: string | null
  refreshingUntil: string | null
  refreshLeaseId: string | null
}

async function readConnections(integrationId: string) {
  const data = await read<{ integrationConnections: StoredConnection[] }>(
    `query ReadConnections($integrationId: UUID!) {
      integrationConnections(where: { integrationId: { eq: $integrationId } }) {
        generation status encryptedAccessToken encryptedRefreshToken refreshingUntil refreshLeaseId
      }
    }`,
    { integrationId },
  )

  return data.integrationConnections
}

async function countAuthorizations(integrationId: string) {
  const data = await read<{ integrationAuthorizations: { id: string }[] }>(
    `query ReadAuthorizations($integrationId: UUID!) {
      integrationAuthorizations(where: { integrationId: { eq: $integrationId } }) { id }
    }`,
    { integrationId },
  )

  return data.integrationAuthorizations.length
}

// Whether an operation was refused for one of the causes named, as a membership's check or its
// reference refuses a caller who is not the member, whichever Data Connect reports first
async function isRefusedEither(operation: Promise<unknown>, causes: string[]) {
  const actual = await refusal(operation)
  const isNamed = actual !== null && causes.some(cause => actual.includes(cause))

  if (actual !== null && !isNamed) console.log(`        refused otherwise: ${actual}`)

  return isNamed
}

async function checkConnections() {
  const id = createId()
  const issuer = 'https://auth.example.com'

  await create({
    integrationId: id,
    authentication: IntegrationAuthentication.OAUTH,
    encryptedApiKey: null,
    apiKeyLastFour: null,
    issuer,
    tools: null,
    toolCount: null,
  })

  const member = { organizationId, userId: memberId, integrationId: id }
  const outsider = { organizationId, userId: outsiderId, integrationId: id }
  const notMember = ['Only a member of an organization can connect an account to its servers', 'membership_fkey']
  const discovered = {
    oauthClientId: 'client-a',
    oauthClientAuthenticationMethod: 'none',
    resource: 'https://mcp.example.com/mcp',
    issuer,
    isIssuerParameterSupported: false,
    tokenEndpoint: `${issuer}/token`,
    revocationEndpoint: null,
  }

  // The registered client, recorded once
  const recordClient = (caller: Variables, clientId: string) =>
    recordOrganizationIntegrationOAuthClient(dataConnect, {
      ...(caller as typeof member),
      configRevision: 0,
      issuer,
      oauthClientId: clientId,
      encryptedOAuthClientSecret: null,
      oauthClientSecretExpiresAt: null,
      oauthClientAuthenticationMethod: 'none',
    })

  check(
    'a member records the client registered',
    (await recordClient(member, 'client-a')).data.organizationIntegration_updateMany === 1,
  )
  check(
    'once: a client registered meanwhile is not recorded over it',
    (await recordClient(member, 'client-b')).data.organizationIntegration_updateMany === 0,
  )
  check('somebody outside records none', await isRefusedEither(recordClient(outsider, 'client-c'), notMember))

  const forget = (clientId: string) =>
    forgetOrganizationIntegrationOAuthClient(dataConnect, { ...member, oauthClientId: clientId })

  check(
    'another client is not forgotten for it',
    (await forget('client-b')).data.organizationIntegration_updateMany === 0,
  )
  check('the client refused is forgotten', (await forget('client-a')).data.organizationIntegration_updateMany === 1)
  await recordClient(member, 'client-a')

  // Starting, the callback and the finish
  const start = (caller: Variables, authorizationId: string, stateHash: string, configRevision = 0) =>
    startIntegrationAuthorization(dataConnect, {
      ...(caller as typeof member),
      configRevision,
      authorizationId,
      stateHash,
      encryptedCodeVerifier: 'v1:local:verifier',
      scope: null,
      ...discovered,
    })
  const firstAuthorization = createId()
  const authorizationId = createId()

  check('a member starts a Connect', (await refusal(start(member, firstAuthorization, `state-a-${checkId}`))) === null)
  await start(member, authorizationId, `state-b-${checkId}`)
  check('a Connect started again replaces the one under way', (await countAuthorizations(id)) === 1)
  check(
    'a Connect started on a revision moved on is refused',
    await isRefused(start(member, createId(), `state-c-${checkId}`, 1), 'The server was changed or deleted meanwhile'),
  )
  check(
    'somebody outside starts none',
    await isRefusedEither(start(outsider, createId(), `state-d-${checkId}`), notMember),
  )

  const byState = await getIntegrationAuthorizationByState(dataConnect, { stateHash: `state-b-${checkId}` })

  check(
    'the callback finds a Connect by its state alone',
    byState.data.integrationAuthorizations[0]?.id === authorizationId
      && byState.data.integrationAuthorizations[0]?.issuer === issuer,
  )

  const receive = (stateHash: string, id_ = authorizationId) =>
    receiveIntegrationAuthorizationCode(dataConnect, {
      authorizationId: id_,
      stateHash,
      encryptedCode: 'v1:local:code',
    })

  check('the callback keeps a code', (await refusal(receive(`state-b-${checkId}`))) === null)
  check(
    'once, so a replayed or concurrent callback keeps none',
    await isRefused(receive(`state-b-${checkId}`), 'The sign-in was finished already or has expired'),
  )
  check(
    'a refusal deletes no Connect whose code came back',
    (await deleteIntegrationAuthorizationByState(dataConnect, { authorizationId, stateHash: `state-b-${checkId}` }))
      .data.integrationAuthorization_deleteMany === 0,
  )

  const consume = (caller: Variables) =>
    consumeIntegrationAuthorization(dataConnect, { ...(caller as typeof member), authorizationId })

  check(
    'another account finishes nothing',
    await isRefused(
      consume({ organizationId, userId: administratorId, integrationId: id }),
      'The sign-in was finished already or has expired',
    ),
  )
  check('the member finishes it', (await refusal(consume(member))) === null)
  check('once', await isRefused(consume(member), 'The sign-in was finished already or has expired'))

  const expiredId = createId()

  await start(member, expiredId, `state-e-${checkId}`)
  await write(
    `mutation Expire($id: UUID!) { integrationAuthorization_update(id: $id, data: { expiresAt_time: { now: true, sub: { minutes: 1 } } }) }`,
    { id: expiredId },
  )
  check(
    'an expired Connect keeps no code',
    await isRefused(receive(`state-e-${checkId}`, expiredId), 'The sign-in was finished already or has expired'),
  )

  const lateId = createId()

  await start(member, lateId, `state-f-${checkId}`)
  await receive(`state-f-${checkId}`, lateId)
  await write(
    `mutation ExpireCode($id: UUID!) { integrationAuthorization_update(id: $id, data: { codeExpiresAt_time: { now: true, sub: { seconds: 1 } } }) }`,
    { id: lateId },
  )
  check(
    'a code past its two minutes is not finished',
    await isRefused(
      consumeIntegrationAuthorization(dataConnect, { ...member, authorizationId: lateId }),
      'The sign-in was finished already or has expired',
    ),
  )
  const canceled = createId()

  await start(member, canceled, `state-k-${checkId}`)
  check(
    'a Cancel naming the Connect a newer one replaced cancels nothing',
    (await cancelIntegrationAuthorization(dataConnect, { ...member, authorizationId: lateId })).data
      .integrationAuthorization_deleteMany === 0,
  )
  check(
    'a Connect is canceled by its id',
    (await cancelIntegrationAuthorization(dataConnect, { ...member, authorizationId: canceled })).data
      .integrationAuthorization_deleteMany === 1,
  )

  // Connecting
  const connect = (caller: Variables, generation: string, fields: Variables = {}) =>
    connectIntegration(dataConnect, {
      ...(caller as typeof member),
      configRevision: 0,
      generation,
      accountLabel: null,
      encryptedAccessToken: `v1:local:access-${generation}`,
      encryptedRefreshToken: `v1:local:refresh-${generation}`,
      accessTokenExpiresAt: null,
      scope: null,
      ...discovered,
      ...fields,
    })
  const firstGeneration = createId()
  const generation = createId()

  check('a member connects', (await refusal(connect(member, firstGeneration))) === null)
  await connect(member, generation)
  check(
    'connecting again replaces the connection, under a new generation',
    (await readConnections(id)).map(connection => connection.generation).join() === generation,
  )
  check(
    'a connection on a revision moved on is refused',
    await isRefused(connect(member, createId(), { configRevision: 1 }), 'The server was changed or deleted meanwhile'),
  )
  check('somebody outside connects nothing', await isRefusedEither(connect(outsider, createId()), notMember))

  type ListedConnections = { integrationConnections: { integrationId: string; status: string }[] }
  const listed = await webConnector.executeQuery<ListedConnections, Variables>(
    'GetIntegrationConnections',
    { organizationId },
    as(memberId),
  )
  const othersListed = await webConnector.executeQuery<ListedConnections, Variables>(
    'GetIntegrationConnections',
    { organizationId },
    as(administratorId),
  )

  check(
    'a member reads their own connection, and no token',
    listed.data.integrationConnections.length === 1
      && listed.data.integrationConnections[0].integrationId === id
      && !('encryptedAccessToken' in listed.data.integrationConnections[0]),
  )
  check('another member reads none of theirs', othersListed.data.integrationConnections.length === 0)

  const recordFirst = () =>
    recordFirstIntegrationTools(dataConnect, {
      ...member,
      configRevision: 0,
      tools: '[]',
      toolCount: 0,
      toolDefinitionHashes: [],
    })

  check('the first connection records the tools', (await recordFirst()).data.organizationIntegration_updateMany === 1)
  check('only while the server has none', (await recordFirst()).data.organizationIntegration_updateMany === 0)

  // Refreshing under a lease
  const claim = (refreshToken: string, leaseId: string) =>
    claimIntegrationConnectionRefresh(dataConnect, {
      ...member,
      generation,
      encryptedRefreshToken: refreshToken,
      refreshLeaseId: leaseId,
    })
  const lease = createId()

  check(
    'a refresh token another refresh spent claims nothing',
    (await claim('v1:local:stale', createId())).data.integrationConnection_updateMany === 0,
  )
  check(
    'a refresh claims the connection',
    (await claim(`v1:local:refresh-${generation}`, lease)).data.integrationConnection_updateMany === 1,
  )
  check(
    'and no other while its lease holds',
    (await claim(`v1:local:refresh-${generation}`, createId())).data.integrationConnection_updateMany === 0,
  )

  const recordTokens = (leaseId: string) =>
    recordIntegrationConnectionTokens(dataConnect, {
      ...member,
      refreshLeaseId: leaseId,
      encryptedAccessToken: 'v1:local:access-refreshed',
      encryptedRefreshToken: 'v1:local:refresh-refreshed',
      accessTokenExpiresAt: null,
      scope: null,
    })

  check(
    'a refresh without the lease writes nothing',
    await isRefused(recordTokens(createId()), 'The refresh lost its lease'),
  )
  check('the refresh holding it writes its tokens', (await refusal(recordTokens(lease))) === null)
  check('and lets the lease go', (await readConnections(id))[0]?.refreshLeaseId === null)

  await write(
    `mutation Lapse($integrationId: UUID!, $leaseId: UUID!) {
      integrationConnection_updateMany(where: { integrationId: { eq: $integrationId } }, data: { refreshingUntil_time: { now: true, sub: { seconds: 1 } }, refreshLeaseId: $leaseId })
    }`,
    { integrationId: id, leaseId: createId() },
  )

  const takeover = createId()

  check(
    'a lapsed lease is taken over',
    (await claim('v1:local:refresh-refreshed', takeover)).data.integrationConnection_updateMany === 1,
  )
  check(
    'a lease is let go',
    (await releaseIntegrationConnectionRefresh(dataConnect, { ...member, refreshLeaseId: takeover })).data
      .integrationConnection_updateMany === 1,
  )

  const markLease = createId()

  await claim('v1:local:refresh-refreshed', markLease)

  const mark = (accessToken: string) =>
    markIntegrationConnectionNeedsAuthentication(dataConnect, {
      ...member,
      generation,
      encryptedAccessToken: accessToken,
      refreshLeaseId: markLease,
    })

  check(
    'a refusal never marks over a token written meanwhile',
    (await mark('v1:local:access-older')).data.integrationConnection_updateMany === 0,
  )
  check(
    'a refusal for good marks the connection',
    (await mark('v1:local:access-refreshed')).data.integrationConnection_updateMany === 1,
  )
  check(
    'which then needs the member and holds no token',
    (await readConnections(id))[0]?.status === 'NEEDS_AUTHENTICATION'
      && (await readConnections(id))[0]?.encryptedAccessToken === null,
  )

  const unrefreshable = createId()

  await connect(member, unrefreshable, { encryptedRefreshToken: null })
  check(
    'a refused token with nothing to refresh it is marked',
    (
      await markIntegrationConnectionTokenRefused(dataConnect, {
        ...member,
        generation: unrefreshable,
        encryptedAccessToken: `v1:local:access-${unrefreshable}`,
      })
    ).data.integrationConnection_updateMany === 1,
  )

  // What a change of the server takes with it
  await connect(member, createId())
  await start(member, createId(), `state-g-${checkId}`)
  await changeOrganizationIntegrationIssuer(dataConnect, {
    ...administrator,
    integrationId: id,
    configRevision: 0,
    issuer: 'https://other.example.com',
  })

  const changed = await getOrganizationIntegrationForAdministrator(dataConnect, { organizationId, integrationId: id })

  check(
    "another issuer takes members' connections, their Connects and the client with it",
    (await readConnections(id)).length === 0
      && (await countAuthorizations(id)) === 0
      && changed.data.organizationIntegrations[0]?.oauthClientId === null,
  )

  const elsewhere = { ...discovered, issuer: 'https://other.example.com' }

  await connect(member, createId(), { configRevision: 1, ...elsewhere })
  await startIntegrationAuthorization(dataConnect, {
    ...member,
    configRevision: 1,
    authorizationId: createId(),
    stateHash: `state-h-${checkId}`,
    encryptedCodeVerifier: 'v1:local:verifier',
    scope: null,
    ...elsewhere,
  })
  await reconfigureOrganizationIntegration(dataConnect, {
    ...administrator,
    integrationId: id,
    name: changed.data.organizationIntegrations[0]?.name ?? '',
    normalizedName: changed.data.organizationIntegrations[0]?.normalizedName ?? '',
    readName: changed.data.organizationIntegrations[0]?.name ?? '',
    configRevision: 1,
    keyGeneration: changed.data.organizationIntegrations[0]?.keyGeneration ?? 0,
    url: 'https://mcp.example.com/v2',
    catalogueSlug: null,
    authentication: IntegrationAuthentication.OAUTH,
    encryptedApiKey: null,
    apiKeyLastFour: null,
    apiKeyScheme: IntegrationApiKeyScheme.BEARER,
    apiKeyHeader: null,
    issuer: 'https://other.example.com',
    tools: null,
    toolCount: null,
    toolDefinitionHashes: [],
  })
  check(
    "another address takes members' connections and their Connects with it",
    (await readConnections(id)).length === 0 && (await countAuthorizations(id)) === 0,
  )

  const moved = { ...discovered, issuer: 'https://other.example.com' }

  const disconnected = createId()

  await connect(member, disconnected, { configRevision: 2, ...moved })
  check(
    'a disconnect leaves a connection of another generation, a reconnect made meanwhile, as it is',
    (await disconnectIntegration(dataConnect, { ...member, generation: createId() })).data
      .integrationConnection_deleteMany === 0,
  )
  check(
    'disconnecting deletes the connection read',
    (await disconnectIntegration(dataConnect, { ...member, generation: disconnected })).data
      .integrationConnection_deleteMany === 1 && (await readConnections(id)).length === 0,
  )

  const pruned = createId()
  const kept = createId()

  await startIntegrationAuthorization(dataConnect, {
    ...member,
    configRevision: 2,
    authorizationId: kept,
    stateHash: `state-i-${checkId}`,
    encryptedCodeVerifier: 'v1:local:verifier',
    scope: null,
    ...moved,
  })
  await startIntegrationAuthorization(dataConnect, {
    organizationId,
    userId: administratorId,
    integrationId: id,
    configRevision: 2,
    authorizationId: pruned,
    stateHash: `state-j-${checkId}`,
    encryptedCodeVerifier: 'v1:local:verifier',
    scope: null,
    ...moved,
  })
  await write(
    `mutation ExpireLong($id: UUID!) { integrationAuthorization_update(id: $id, data: { expiresAt_time: { now: true, sub: { hours: 2 } } }) }`,
    { id: pruned },
  )
  await pruneIntegrationAuthorizations(dataConnect)
  check(
    'the sweep prunes the Connects expired over an hour ago, and keeps the rest',
    (await countAuthorizations(id)) === 1,
  )

  await connect(member, createId(), { configRevision: 2, ...moved })
  await write(
    `mutation Remove($organizationId: UUID!, $memberId: String!) {
      userOrganization_delete(key: { userId: $memberId, organizationId: $organizationId })
    }`,
    { organizationId, memberId },
  )
  check(
    "a member's removal takes their connection and their Connects with their membership",
    (await readConnections(id)).length === 0 && (await countAuthorizations(id)) === 0,
  )
}

try {
  await setUp()
  await checkCreating()
  await checkTheLimit()
  await checkTheLiveList()
  await checkRenaming()
  await checkReconfiguring()
  await checkKeysAndTools()
  await checkIssuers()
  await checkEnabling()
  await checkDeletingAndRestoring()
  // Last, since it removes the checked member
  await checkConnections()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')

process.exit(0)
