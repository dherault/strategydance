import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import { DEVELOPMENT_API_URL, MAX_AGENT_CONNECTIONS, SERVED_MODULE_NAMES } from 'strategydance-core'
import {
  approveOAuthAuthorizationRequest,
  connectorConfig,
  createOAuthAuthorizationRequest,
  denyOAuthAuthorizationRequest,
  exchangeOAuthAuthorizationCode,
  getAgentConnectionRefreshToken,
  getOAuthAuthorizationRequestByCode,
  pruneAgentConnectionTokens,
  pruneOAuthAuthorizationRequests,
  pruneOAuthClients,
  pruneUnservedAgentConnections,
  recordAgentConnectionUse,
  revokeAgentConnection,
  rotateAgentConnectionRefreshToken,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID, MODULE_PROTOCOL_VERSION } from '~constants'

import { authentication, dataConnect } from '~firebase'

import createAgentConnectionTokenVerifier from '~domain/oauth/createAgentConnectionTokenVerifier'
import isConnectionGoneRefusal from '~domain/oauth/isConnectionGoneRefusal'
import isMembershipRefusal from '~domain/oauth/isMembershipRefusal'

import readModuleCaller from '~modules/readModuleCaller'

/*
  Checks the authorization server against the local backend and the emulators, where CI cannot:

    bun run check:oauth

  First the whole flow, as an external agent and a member would go through it, against the backend
  at `API_URL`, `bun run dev:backend` unless it says otherwise: it registers a loopback client,
  authorizes, approves as an account signed in to the Auth emulator, exchanges the code, has the
  token verifier take the access token, calls the Documents module's endpoint with it, refreshes,
  presents the spent refresh token again, has the endpoint challenge a token narrowed to read when
  it writes, and revokes.

  Then what guards it in its operations' SQL conditions: a request decided once, a code used once, a
  refresh token rotated once, one connection per member, client and module, and the cascades that
  take a connection's tokens with it, calling the backend connector's own operations as the
  endpoints call them, at once where two requests could race. The domain's tests run against a fake
  of these operations: this is what says the fake's conditions are the SQL's.

  And what the account page's Connected agents tab runs through the browser's connector: its list
  holds the member's connections alone, and Disconnect deletes one of theirs alone, with its tokens,
  so the agent's next refresh and its next call to the module are refused. Allow holds a member to `MAX_AGENT_CONNECTIONS`, so the
  tab lists every one.

  And the Tasks and the Budget modules' endpoints, each beside the Documents module's, for one agent
  connected to both: each module's token opens that module alone, a query draws on the member's
  search allowance, a token granted read alone is challenged when it writes, and Disconnect of one
  connection leaves the other working.

  It makes a throwaway organization with a member, removes everything it made, then exits non-zero
  naming each check that failed. The sweep's deletes take no organization: they remove every expired
  request and token, every connection to a module no endpoint serves, and every unused registration,
  in the emulator.

  Like `checkConversationSearch.ts`, it refuses to run unless it points at the emulators
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST or FIREBASE_AUTH_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:oauth`',
  )
  process.exit(1)
}

const apiUrl = process.env.API_URL ?? DEVELOPMENT_API_URL

// The browser's connector, on an app of its own, as `checkConversationList.ts` explains
const webConnector = getDataConnect(
  { ...connectorConfig, connector: 'strategydance-web-connector' },
  initializeApp({ projectId: FIREBASE_PROJECT_ID }, 'web-connector'),
)

// Dashless, as the emulator writes a UUID back, so an id read compares with the one made
function createId() {
  return randomUUID().replaceAll('-', '')
}

function createHashOf(value: string) {
  return createHash('sha256').update(value).digest('base64url')
}

function createSecret() {
  return randomBytes(32).toString('base64url')
}

const checkId = createId().slice(0, 8)
const organizationId = createId()
const otherOrganizationId = createId()
const userId = `check-oauth-${checkId}-member`
const otherUserId = `check-oauth-${checkId}-other`
// The backend's own issuer names its modules, so a token made here is one it refreshes
const resource = `${apiUrl}/mcp/documents`
const READ_WRITE = ['documents:read', 'documents:write']

// The modules a check connects an agent to, Documents unless it says otherwise
const DOCUMENTS = { name: 'documents', resource } as const
const TASKS = { name: 'tasks', resource: `${apiUrl}/mcp/tasks` } as const
const BUDGET = { name: 'budget', resource: `${apiUrl}/mcp/budget` } as const

type CheckedModule = typeof DOCUMENTS | typeof TASKS | typeof BUDGET

// What the check made that its organization does not take with it, for the tear down
const clientIds = new Set<string>()
const registeredClientIds = new Set<string>()

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

async function setUp() {
  for (const account of [userId, otherUserId]) {
    await webConnector.executeMutation(
      'CreateCurrentUser',
      { locale: 'EN', authenticationProviders: [] },
      { impersonate: { authClaims: { sub: account, email: `${account}@example.com` } } },
    )
  }

  await write(
    `mutation SetUp($organizationId: UUID!, $otherOrganizationId: UUID!, $userId: String!, $otherUserId: String!) {
      organization_insert(data: { id: $organizationId, name: "Checked organization" })
      other: organization_insert(data: { id: $otherOrganizationId, name: "Another organization" })
      userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: MEMBER })
      otherMember: userOrganization_insert(data: { userId: $otherUserId, organizationId: $organizationId, role: MEMBER })
    }`,
    { organizationId, otherOrganizationId, userId, otherUserId },
  )
}

async function tearDown() {
  await write(
    `mutation TearDown(
      $organizationId: UUID!
      $otherOrganizationId: UUID!
      $userId: String!
      $otherUserId: String!
      $clientIds: [String!]!
      $registeredClientIds: [UUID!]!
    ) {
      organization_delete(id: $organizationId)
      other: organization_delete(id: $otherOrganizationId)
      user_delete(id: $userId)
      otherUser: user_delete(id: $otherUserId)
      oAuthAuthorizationRequest_deleteMany(where: { clientId: { in: $clientIds } })
      oAuthClient_deleteMany(where: { id: { in: $registeredClientIds } })
    }`,
    {
      organizationId,
      otherOrganizationId,
      userId,
      otherUserId,
      clientIds: [...clientIds],
      registeredClientIds: [...registeredClientIds],
    },
  )
}

// An ID token for the member, from the Auth emulator, which takes a custom token the Admin SDK makes
// without signing it, as `sendConversationMessage.ts` signs in
async function signIn() {
  const customToken = await authentication.createCustomToken(userId)
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  const { idToken } = (await response.json()) as { idToken?: string }

  if (!idToken) throw new Error(`The Auth emulator did not sign the member in: ${response.status}`)

  return idToken
}

type Metadata = {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint: string
  revocation_endpoint: string
  scopes_supported: string[]
}

type Tokens = { access_token: string; refresh_token: string; scope: string }

async function readMetadata() {
  try {
    const response = await fetch(`${apiUrl}/.well-known/oauth-authorization-server`)

    return (await response.json()) as Metadata
  } catch (error) {
    console.error(`The backend does not answer on ${apiUrl}: start it with \`bun run dev:backend\``)

    throw error
  }
}

// An external agent on a module's endpoint, as the SDK's client calls it with its bearer token
async function openModule(endpoint: string, token: string) {
  const client = new Client(
    { name: `check-oauth-${checkId}`, version: '1.0.0' },
    { versionNegotiation: { mode: { pin: MODULE_PROTOCOL_VERSION } } },
  )

  await client.connect(
    new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  )

  return client
}

// One request to a module's endpoint in a 2025 revision, as raw HTTP, for what its status and its
// challenge say
function postModule(endpoint: string, token: string | null, message: Record<string, unknown>) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-11-25',
      ...(token !== null && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...message }),
  })
}

async function readLastUsedAt(connectionId: string) {
  const data = await read<{ agentConnection: { lastUsedAt: string | null } | null }>(
    `query ReadLastUsedAt($id: UUID!) { agentConnection(id: $id) { lastUsedAt } }`,
    { id: connectionId },
  )

  return data.agentConnection?.lastUsedAt ?? null
}

// What the module's endpoint answers an external agent: nothing without a token, its tools with
// one, as the member, and a connection marked used at most once a minute
async function checkEndpoint(issuer: string, clientId: string, tokens: Tokens) {
  const unauthorized = await postModule(resource, null, { method: 'tools/list' })
  const resourceMetadataUrl = `${issuer}/.well-known/oauth-protected-resource/mcp/documents`

  check(
    "the module's endpoint answers a call without a token 401, naming its protected resource metadata",
    unauthorized.status === 401
      && (unauthorized.headers.get('www-authenticate') ?? '').includes(`resource_metadata="${resourceMetadataUrl}"`),
  )

  const resourceMetadata = (await (await fetch(resourceMetadataUrl)).json()) as {
    resource?: string
    authorization_servers?: string[]
  }

  check(
    'the protected resource metadata names the module and the authorization server',
    resourceMetadata.resource === resource && resourceMetadata.authorization_servers?.[0] === issuer,
  )

  const client = await openModule(resource, tokens.access_token)
  const { tools } = await client.listTools()
  const created = await client.callTool({
    name: 'create_document',
    arguments: { title: `Checked ${checkId}`, aspects: [], content: 'Written by an external agent.' },
  })
  const { id: documentId } = created.structuredContent as { id: string }
  const found = await client.callTool({ name: 'read_document', arguments: { id: documentId } })

  check("the endpoint lists the module's eight tools to the access token", tools.length === 8)
  check(
    'the endpoint writes a document as the member and reads it back',
    !created.isError && !found.isError && (found.structuredContent as { title: string }).title === `Checked ${checkId}`,
  )

  await client.close()

  const [connection] = await readConnections(clientId)
  const connectionId = connection?.id ?? ''

  check('the endpoint marks the connection used', (await readLastUsedAt(connectionId)) !== null)

  const recordUse = async (account: string) =>
    (await recordAgentConnectionUse(dataConnect, { id: connectionId, userId: account })).data.agentConnection_updateMany

  check('marking the connection used again within the minute writes nothing', (await recordUse(userId)) === 0)

  await write(
    `mutation AgeLastUse($id: UUID!) {
      agentConnection_update(id: $id, data: { lastUsedAt_time: { now: true, sub: { minutes: 2 } } })
    }`,
    { id: connectionId },
  )

  const aged = await readLastUsedAt(connectionId)

  check("another member's account marks the connection used never", (await recordUse(otherUserId)) === 0)
  check(
    'marking the connection used over a minute later writes it',
    (await recordUse(userId)) === 1 && (await readLastUsedAt(connectionId)) !== aged,
  )
}

async function checkFlow() {
  const metadata = await readMetadata()
  const resource = `${metadata.issuer}/mcp/documents`
  const redirectUri = 'http://127.0.0.1:43210/callback'
  const form = { 'Content-Type': 'application/x-www-form-urlencoded' }

  check(
    'the metadata names the endpoints under the issuer',
    [
      metadata.authorization_endpoint,
      metadata.token_endpoint,
      metadata.registration_endpoint,
      metadata.revocation_endpoint,
    ].every(endpoint => endpoint.startsWith(`${metadata.issuer}/oauth/`)),
  )

  // A client registers, on loopback
  const registration = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: `Check ${checkId}`, redirect_uris: ['http://127.0.0.1/callback'] }),
  })
  const { client_id: clientId } = (await registration.json()) as { client_id: string }

  clientIds.add(clientId)
  registeredClientIds.add(clientId)
  check('a loopback client registers', registration.status === 201 && /^[0-9a-f]{32}$/.test(clientId))

  // It asks for the member's documents, which sends the browser to the consent page
  const verifier = createSecret()
  const state = `state-${checkId}`
  const authorizeUrl = new URL(metadata.authorization_endpoint)

  for (const [name, value] of Object.entries({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: createHashOf(verifier),
    code_challenge_method: 'S256',
    resource,
    scope: READ_WRITE.join(' '),
    state,
  })) {
    authorizeUrl.searchParams.set(name, value)
  }

  const authorization = await fetch(authorizeUrl, { redirect: 'manual' })
  const consentUrl = new URL(authorization.headers.get('location') ?? 'invalid:')
  const requestId = consentUrl.searchParams.get('request') ?? ''

  check(
    'an authorization sends the browser to the consent page',
    authorization.status === 302 && consentUrl.pathname === '/oauth/consent' && Boolean(requestId),
  )

  // The Subagents module is served to no external agent, so its address is refused as one no module
  // has, back to the client, and the metadata offers none of its scopes
  const subagentsUrl = new URL(authorizeUrl)

  subagentsUrl.searchParams.set('resource', `${metadata.issuer}/mcp/subagents`)
  subagentsUrl.searchParams.set('scope', 'subagents:read subagents:write')

  const subagents = await fetch(subagentsUrl, { redirect: 'manual' })
  const subagentsAnswer = new URL(subagents.headers.get('location') ?? 'invalid:')

  check(
    'an authorization for the Subagents module, served to nobody, is refused as for an address no module has',
    subagents.status === 302
      && subagentsAnswer.searchParams.get('error') === 'invalid_target'
      && !metadata.scopes_supported.some(scope => scope.startsWith('subagents:')),
  )

  // The member reads it and allows it
  const headers = { Authorization: `Bearer ${await signIn()}`, 'Content-Type': 'application/json' }
  const reading = await fetch(`${apiUrl}/oauth/requests/${requestId}`, { headers })
  const { data: summary } = (await reading.json()) as {
    data?: { module: string; client: { isVerified: boolean }; isLoopbackRedirect: boolean; scopes: string[] }
  }

  check(
    'the consent page reads the request: the module, an unverified client, a loopback address, the access asked',
    reading.status === 200
      && summary?.module === 'documents'
      && !summary.client.isVerified
      && summary.isLoopbackRedirect
      && summary.scopes.join(' ') === READ_WRITE.join(' '),
  )

  const approval = await fetch(`${apiUrl}/oauth/requests/${requestId}/approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ organizationId, scopes: READ_WRITE }),
  })
  const { data: decision } = (await approval.json()) as { data?: { redirectUrl: string } }
  const answer = new URL(decision?.redirectUrl ?? 'invalid:')
  const code = answer.searchParams.get('code') ?? ''

  check(
    'Allow sends the browser back with the code, the state and the exact issuer',
    approval.status === 200
      && answer.href.startsWith(`${redirectUri}?`)
      && answer.searchParams.get('state') === state
      && answer.searchParams.get('iss') === metadata.issuer
      && Boolean(code),
  )

  // The client exchanges the code
  const token = (fields: Record<string, string>) =>
    fetch(metadata.token_endpoint, { method: 'POST', headers: form, body: new URLSearchParams(fields) })
  const exchange = await token({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    resource,
  })
  const tokens = (await exchange.json()) as Tokens

  check(
    'the code is exchanged for a pair of the scopes allowed, never cached',
    exchange.status === 200
      && tokens.scope === READ_WRITE.join(' ')
      && exchange.headers.get('cache-control') === 'no-store'
      && exchange.headers.get('pragma') === 'no-cache',
  )

  // The module's endpoint would take the access token, and nothing else
  const documentsVerifier = createAgentConnectionTokenVerifier(new URL(resource))
  const tasksVerifier = createAgentConnectionTokenVerifier(new URL(`${metadata.issuer}/mcp/tasks`))
  const authInfo = await documentsVerifier.verifyAccessToken(tokens.access_token).catch(() => null)

  check(
    'the verifier takes the access token as the member, with the scopes allowed',
    authInfo !== null
      && readModuleCaller(authInfo).userId === userId
      && readModuleCaller(authInfo).scopes.join(' ') === READ_WRITE.join(' '),
  )
  check(
    'the verifier refuses the access token for another module',
    (await refusal(tasksVerifier.verifyAccessToken(tokens.access_token))) !== null,
  )
  check(
    'the verifier refuses the refresh token',
    (await refusal(documentsVerifier.verifyAccessToken(tokens.refresh_token))) !== null,
  )

  await checkEndpoint(metadata.issuer, clientId, tokens)

  // The client refreshes, and its spent token comes back
  const refresh = (refreshToken: string, scope?: string) =>
    token({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      resource,
      ...(scope ? { scope } : {}),
    })
  const rotated = (await (await refresh(tokens.refresh_token)).json()) as Tokens
  const duplicate = (await (await refresh(tokens.refresh_token)).json()) as Tokens

  check(
    'a refresh rotates into a new pair',
    Boolean(rotated.refresh_token) && rotated.refresh_token !== tokens.refresh_token,
  )
  check(
    'the spent refresh token presented again is answered with the same pair',
    duplicate.access_token === rotated.access_token && duplicate.refresh_token === rotated.refresh_token,
  )

  // A refresh naming read alone narrows its access token, and its refresh token keeps both
  const narrowed = (await (await refresh(rotated.refresh_token, 'documents:read')).json()) as Tokens
  const narrowedInfo = await documentsVerifier.verifyAccessToken(narrowed.access_token).catch(() => null)

  check(
    'a refresh naming read alone narrows its access token to read',
    narrowed.scope === 'documents:read' && narrowedInfo?.scopes.join(' ') === 'documents:read',
  )

  const challenged = await postModule(resource, narrowed.access_token, {
    method: 'tools/call',
    params: { name: 'create_document', arguments: { title: 'Refused', aspects: [], content: 'Never written.' } },
  })
  const challenge = challenged.headers.get('www-authenticate') ?? ''

  check(
    "the endpoint challenges a read-only token's write, naming the write scope",
    challenged.status === 403
      && challenge.includes('error="insufficient_scope"')
      && challenge.includes('scope="documents:write"'),
  )

  // The client revokes
  const revocation = await fetch(metadata.revocation_endpoint, {
    method: 'POST',
    headers: form,
    body: new URLSearchParams({ token: narrowed.refresh_token, client_id: clientId }),
  })

  check('a refresh token is revoked', revocation.status === 200)
  check('a revoked refresh token is refused', (await refresh(narrowed.refresh_token)).status === 400)
  check(
    "the revoked connection's access token is refused",
    (await refusal(documentsVerifier.verifyAccessToken(narrowed.access_token))) !== null,
  )
  check(
    "the module's endpoint refuses the revoked connection's access token",
    (await postModule(resource, narrowed.access_token, { method: 'tools/list' })).status === 401,
  )
}

// A pending request a client made, asking for read and write unless told otherwise
async function createRequest(clientId: string, scopes = READ_WRITE, module: CheckedModule = DOCUMENTS) {
  clientIds.add(clientId)

  const { data } = await createOAuthAuthorizationRequest(dataConnect, {
    clientId,
    registeredClientId: null,
    redirectUri: 'http://127.0.0.1:43210/callback',
    codeChallenge: createHashOf(createSecret()),
    resource: module.resource,
    scopes,
    state: 'checked',
  })

  return data.oAuthAuthorizationRequest_insert.id
}

// Allows a request as the member, or another account, answering the connection's id and the code
function approve(
  requestId: string,
  clientId: string,
  {
    scopes = READ_WRITE,
    organization = organizationId,
    user = userId,
    module = DOCUMENTS,
  }: { scopes?: string[]; organization?: string; user?: string; module?: CheckedModule } = {},
) {
  const connectionId = createId()
  const code = createSecret()

  return {
    connectionId,
    code,
    approval: approveOAuthAuthorizationRequest(dataConnect, {
      id: requestId,
      userId: user,
      organizationId: organization,
      connectionId,
      clientId,
      registeredClientId: null,
      clientName: 'Checked client',
      module: module.name,
      resource: module.resource,
      scopes,
      codeHash: createHashOf(code),
    }),
  }
}

async function readConnections(clientId: string) {
  const data = await read<{ agentConnections: { id: string; scopes: string[] }[] }>(
    `query ReadConnections($userId: String!, $clientId: String!) {
      agentConnections(where: { membershipUserId: { eq: $userId }, clientId: { eq: $clientId } }) { id scopes }
    }`,
    { userId, clientId },
  )

  return data.agentConnections
}

async function countTokens(connectionId: string) {
  const data = await read<{ agentConnectionTokens: { id: string }[] }>(
    `query CountTokens($connectionId: UUID!) {
      agentConnectionTokens(where: { connectionId: { eq: $connectionId } }) { id }
    }`,
    { connectionId },
  )

  return data.agentConnectionTokens.length
}

function exchange(
  requestId: string,
  code: string,
  connectionId: string,
  { scopes = READ_WRITE, module = DOCUMENTS }: { scopes?: string[]; module?: CheckedModule } = {},
) {
  const accessToken = createSecret()
  const refreshToken = createSecret()

  return {
    accessToken,
    refreshToken,
    exchange: exchangeOAuthAuthorizationCode(dataConnect, {
      id: requestId,
      codeHash: createHashOf(code),
      connectionId,
      resource: module.resource,
      scopes,
      accessTokenHash: createHashOf(accessToken),
      refreshTokenHash: createHashOf(refreshToken),
    }),
  }
}

async function checkConsent() {
  const clientId = `https://check-${checkId}.example.com/consent.json`

  // Sequentially: consenting again replaces the connection
  const first = await createRequest(clientId)
  const firstApproval = approve(first, clientId)

  check('an Allow makes a connection', (await refusal(firstApproval.approval)) === null)

  const second = await createRequest(clientId, ['documents:read'])
  const secondApproval = approve(second, clientId, { scopes: ['documents:read'] })

  check('consenting again goes through', (await refusal(secondApproval.approval)) === null)

  const connections = await readConnections(clientId)

  check(
    'consenting again replaces the connection with one of the access last allowed',
    connections.length === 1
      && connections[0]?.id === secondApproval.connectionId
      && connections[0].scopes.join() === 'documents:read',
  )

  const { data: replaced } = await getOAuthAuthorizationRequestByCode(dataConnect, {
    codeHash: createHashOf(firstApproval.code),
  })

  check("the replaced connection's code opens nothing", replaced.oAuthAuthorizationRequests[0]?.connection === null)

  const replacedExchange = await refusal(exchange(first, firstApproval.code, firstApproval.connectionId).exchange)

  check(
    "the replaced connection's code is refused at the exchange, as the backend reads a gone connection",
    replacedExchange !== null
      && (isConnectionGoneRefusal(replacedExchange)
        || replacedExchange.includes('The code was used already or has expired')),
  )

  // Allow sent twice
  const twice = await createRequest(clientId)
  const twiceApprovals = [approve(twice, clientId), approve(twice, clientId)]
  const twiceRefusals = await Promise.all(twiceApprovals.map(({ approval }) => refusal(approval)))
  const afterTwice = await readConnections(clientId)

  check('Allow sent twice at once decides the request once', twiceRefusals.filter(cause => cause === null).length === 1)
  check(
    'Allow sent twice at once leaves one connection, the one that decided',
    afterTwice.length === 1
      && afterTwice[0]?.id === twiceApprovals[twiceRefusals.findIndex(cause => cause === null)]?.connectionId,
  )

  // Two consents at once, on two requests for one client, organization and module, a few times over
  let leftOne = true
  let wentThrough = true

  for (let round = 0; round < 5; round++) {
    const requests = await Promise.all([createRequest(clientId), createRequest(clientId)])
    const approvals = requests.map(requestId => approve(requestId, clientId))
    const causes = await Promise.all(approvals.map(({ approval }) => refusal(approval)))

    if (causes.some(cause => cause !== null)) {
      wentThrough = false
      console.log(`        ${causes.filter(Boolean).join(' / ')}`)
    }

    if ((await readConnections(clientId)).length !== 1) leftOne = false
  }

  check('two consents at once both go through, one after the other', wentThrough)
  check('two consents at once leave one connection', leftOne)

  // An Allow racing a Deny
  const raced = await createRequest(clientId)
  const racing = approve(raced, clientId)
  const [allowCause, denyCause] = await Promise.all([
    refusal(racing.approval),
    refusal(denyOAuthAuthorizationRequest(dataConnect, { id: raced })),
  ])

  check('an Allow racing a Deny decides the request once', (allowCause === null) !== (denyCause === null))

  // A Deny, then an Allow
  const denied = await createRequest(clientId)

  check('a Deny goes through', (await refusal(denyOAuthAuthorizationRequest(dataConnect, { id: denied }))) === null)
  check('a denied request is refused a later Allow', (await refusal(approve(denied, clientId).approval)) !== null)
  check(
    'an allowed request is refused a later Deny',
    (await refusal(denyOAuthAuthorizationRequest(dataConnect, { id: twice }))) !== null,
  )

  // What a consent may grant
  const readOnly = await createRequest(clientId, ['documents:read'])

  check(
    'an Allow granting a scope the request did not ask for is refused',
    (await refusal(approve(readOnly, clientId).approval)) !== null,
  )
  const outsider = await refusal(
    approve(readOnly, clientId, { scopes: ['documents:read'], organization: otherOrganizationId }).approval,
  )

  check(
    'an Allow for an organization the account is not in is refused, as the backend reads a membership refusal',
    outsider !== null && isMembershipRefusal(outsider),
  )
}

// The Connected agents tab's list, through the browser's connector as the given account
async function readAgentConnections(account: string) {
  const { data } = await webConnector.executeQuery<
    { agentConnections: { id: string; membership: { organization: { id: string } } }[] },
    Variables
  >('GetAgentConnections', {}, { impersonate: { authClaims: { sub: account } } })

  return data.agentConnections
}

// Disconnect, through the browser's connector as the member, naming the `$userId` given
function disconnect(connectionId: string, claimedUserId = userId) {
  return webConnector.executeMutation(
    'DeleteAgentConnection',
    { userId: claimedUserId, id: connectionId },
    { impersonate: { authClaims: { sub: userId } } },
  )
}

async function checkConnectedAgents() {
  const metadata = await readMetadata()
  const form = { 'Content-Type': 'application/x-www-form-urlencoded' }
  const clientId = `https://check-${checkId}.example.com/connected.json`
  const otherClientId = `https://check-${checkId}.example.com/other-member.json`

  // The member connects an agent, and another member of the organization one of their own
  const requestId = await createRequest(clientId)
  const connection = approve(requestId, clientId)

  await connection.approval

  const { refreshToken, exchange: exchanged } = exchange(requestId, connection.code, connection.connectionId)

  await exchanged

  const otherRequestId = await createRequest(otherClientId)
  const otherConnection = approve(otherRequestId, otherClientId, { user: otherUserId })

  await otherConnection.approval

  const listed = await readAgentConnections(userId)

  check(
    "the Connected agents tab lists the member's connections, with their organization, and nobody else's",
    listed.some(({ id, membership }) => id === connection.connectionId && membership.organization.id === organizationId)
      && !listed.some(({ id }) => id === otherConnection.connectionId),
  )
  check(
    'Disconnect naming another account than the caller is refused',
    (await refusal(disconnect(connection.connectionId, otherUserId))) !== null,
  )
  check(
    "Disconnect of another member's connection goes through and deletes nothing",
    (await refusal(disconnect(otherConnection.connectionId))) === null
      && (await readAgentConnections(otherUserId)).some(({ id }) => id === otherConnection.connectionId),
  )

  // The agent refreshes before Disconnect, and is refused after it
  const refresh = (token: string) =>
    fetch(metadata.token_endpoint, {
      method: 'POST',
      headers: form,
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token, client_id: clientId, resource }),
    })
  const rotation = await refresh(refreshToken)
  const rotated = (await rotation.json()) as Tokens

  check('the agent refreshes before Disconnect', rotation.status === 200 && Boolean(rotated.refresh_token))
  check(
    "the agent calls the module's endpoint before Disconnect",
    (await postModule(resource, rotated.access_token, { method: 'tools/list' })).status === 200,
  )
  check('Disconnect goes through', (await refusal(disconnect(connection.connectionId))) === null)
  check(
    'Disconnect takes the connection off the list',
    !(await readAgentConnections(userId)).some(({ id }) => id === connection.connectionId),
  )
  check("Disconnect deletes the connection's tokens", (await countTokens(connection.connectionId)) === 0)

  const refused = await refresh(rotated.refresh_token)
  const { error } = (await refused.json()) as { error?: string }

  check("the agent's next refresh is refused after Disconnect", refused.status === 400 && error === 'invalid_grant')
  check(
    "the agent's next call to the module's endpoint is refused after Disconnect",
    (await postModule(resource, rotated.access_token, { method: 'tools/list' })).status === 401,
  )
  check(
    'Disconnecting again changes nothing and goes through',
    (await refusal(disconnect(connection.connectionId))) === null,
  )
}

// An agent the member connected to a module, through Allow and the exchange, answering its access token
// and its connection's id
async function connectModule(clientId: string, module: CheckedModule, scopes: string[]) {
  const requestId = await createRequest(clientId, scopes, module)
  const connection = approve(requestId, clientId, { scopes, module })

  await connection.approval

  const exchanged = exchange(requestId, connection.code, connection.connectionId, { scopes, module })

  await exchanged.exchange

  return { accessToken: exchanged.accessToken, connectionId: connection.connectionId }
}

async function countSearches() {
  const data = await read<{ conversationSearches: { id: string }[] }>(
    `query CountSearches($userId: String!, $organizationId: UUID!) {
      conversationSearches(where: { userId: { eq: $userId }, organizationId: { eq: $organizationId } }) { id }
    }`,
    { userId, organizationId },
  )

  return data.conversationSearches.length
}

async function countTasksNamed(name: string) {
  const data = await read<{ tasks: { id: string }[] }>(
    `query CountTasksNamed($organizationId: UUID!, $name: String!) {
      tasks(where: { organizationId: { eq: $organizationId }, name: { eq: $name } }) { id }
    }`,
    { organizationId, name },
  )

  return data.tasks.length
}

async function countBillsNamed(name: string) {
  const data = await read<{ bills: { id: string }[] }>(
    `query CountBillsNamed($organizationId: UUID!, $name: String!) {
      bills(where: { organizationId: { eq: $organizationId }, name: { eq: $name } }) { id }
    }`,
    { organizationId, name },
  )

  return data.bills.length
}

// What `checkModuleEndpoint` needs of a module served beside Documents: its title, scopes and tool
// count, the write it makes, one item named as the check names it, and the list whose query finds
// that item, the item's address ending in the module's name and its id
type CheckedEndpoint = {
  module: typeof TASKS | typeof BUDGET
  title: string
  scopes: { read: string; write: string }
  toolCount: number
  item: string
  write: { tool: string; arguments: (name: string) => Record<string, unknown> }
  list: { tool: string; key: string }
  countNamed: (name: string) => Promise<number>
}

const TASKS_ENDPOINT: CheckedEndpoint = {
  module: TASKS,
  title: 'Tasks',
  scopes: { read: 'tasks:read', write: 'tasks:write' },
  toolCount: 8,
  item: 'task',
  write: { tool: 'create_task', arguments: name => ({ name, status: 'TODO' }) },
  list: { tool: 'list_tasks', key: 'tasks' },
  countNamed: countTasksNamed,
}

const BUDGET_ENDPOINT: CheckedEndpoint = {
  module: BUDGET,
  title: 'Budget',
  scopes: { read: 'budget:read', write: 'budget:write' },
  toolCount: 7,
  item: 'bill',
  write: {
    tool: 'add_bill',
    arguments: name => ({ name, company: 'Checked company', amount: '10.00', currency: 'USD' }),
  },
  list: { tool: 'list_bills', key: 'bills' },
  countNamed: countBillsNamed,
}

/*
  A module's endpoint beside the Documents module's, for one agent the member connected to both:
  each module's token opens that module alone, a query counts against the member's search
  allowance, a token granted read alone is challenged when it writes, and Disconnect of the module's
  connection stops its calls while the Documents connection's go on
*/
async function checkModuleEndpoint({
  module,
  title,
  scopes,
  toolCount,
  item,
  write,
  list,
  countNamed,
}: CheckedEndpoint) {
  const metadata = await readMetadata()
  const readWrite = [scopes.read, scopes.write]
  const clientId = `https://check-${checkId}.example.com/${module.name}-and-documents.json`
  const documents = await connectModule(clientId, DOCUMENTS, READ_WRITE)
  const connected = await connectModule(clientId, module, readWrite)
  const resourceMetadataUrl = `${metadata.issuer}/.well-known/oauth-protected-resource/mcp/${module.name}`
  const resourceMetadata = (await (await fetch(resourceMetadataUrl)).json()) as {
    resource?: string
    authorization_servers?: string[]
    scopes_supported?: string[]
  }

  check(
    `the ${title} module's protected resource metadata names it, its scopes and the authorization server`,
    resourceMetadata.resource === module.resource
      && resourceMetadata.authorization_servers?.[0] === metadata.issuer
      && resourceMetadata.scopes_supported?.join(' ') === readWrite.join(' '),
  )

  for (const [name, token] of [
    ['no token', null],
    ['a Documents token', documents.accessToken],
  ] as const) {
    const refused = await postModule(module.resource, token, { method: 'tools/list' })

    check(
      `the ${title} module's endpoint answers ${name} 401, naming its protected resource metadata`,
      refused.status === 401
        && (refused.headers.get('www-authenticate') ?? '').includes(`resource_metadata="${resourceMetadataUrl}"`),
    )
  }

  check(
    `the Documents module's endpoint answers a ${title} token 401`,
    (await postModule(DOCUMENTS.resource, connected.accessToken, { method: 'tools/list' })).status === 401,
  )

  const name = `Checked ${checkId}`
  const client = await openModule(module.resource, connected.accessToken)
  const { tools } = await client.listTools()
  const written = await client.callTool({ name: write.tool, arguments: write.arguments(name) })
  const { id: itemId, url } = written.structuredContent as { id: string; url?: string }
  const searchesBefore = await countSearches()
  const found = await client.callTool({ name: list.tool, arguments: { query: checkId } })
  const searchesAfterQuery = await countSearches()

  await client.callTool({ name: list.tool, arguments: {} })

  check(`the endpoint lists the ${title} module's ${toolCount} tools to its access token`, tools.length === toolCount)
  check(
    `the endpoint writes a ${item} as the member, with its web address`,
    !written.isError && (await countNamed(name)) === 1 && Boolean(url?.endsWith(`/${module.name}/${itemId}`)),
  )
  check(
    `an external query finds the ${item} and counts against the member's search allowance`,
    !found.isError
      && (found.structuredContent as Record<string, { id: string }[]>)[list.key].some(({ id }) => id === itemId)
      && searchesAfterQuery === searchesBefore + 1,
  )
  check(`an external ${list.tool} without a query counts no search`, (await countSearches()) === searchesAfterQuery)

  await client.close()

  const readOnly = await connectModule(`https://check-${checkId}.example.com/${module.name}-read.json`, module, [
    scopes.read,
  ])
  const challenged = await postModule(module.resource, readOnly.accessToken, {
    method: 'tools/call',
    params: { name: write.tool, arguments: write.arguments(`Refused ${checkId}`) },
  })
  const challenge = challenged.headers.get('www-authenticate') ?? ''

  check(
    `the endpoint challenges a read-only ${title} token's write, naming ${scopes.write}, and writes nothing`,
    challenged.status === 403
      && challenge.includes('error="insufficient_scope"')
      && challenge.includes(`scope="${scopes.write}"`)
      && (await countNamed(`Refused ${checkId}`)) === 0,
  )

  check(
    `Disconnect of the ${title} connection goes through`,
    (await refusal(disconnect(connected.connectionId))) === null,
  )
  check(
    `the ${title} connection's next call is refused after its Disconnect`,
    (await postModule(module.resource, connected.accessToken, { method: 'tools/list' })).status === 401,
  )
  check(
    "the Documents connection of the same agent still calls its module's endpoint",
    (await postModule(DOCUMENTS.resource, documents.accessToken, { method: 'tools/list' })).status === 200,
  )
}

// A member connects at most `MAX_AGENT_CONNECTIONS` agents, so the Connected agents tab lists every one
async function checkConnectionCap() {
  const capClientIds: string[] = Array.from({ length: MAX_AGENT_CONNECTIONS + 1 }, (_, index) => {
    return `https://check-${checkId}-cap${index}.example.com/agent.json`
  })
  const { agentConnections: held } = await read<{ agentConnections: { id: string }[] }>(
    `query Held($userId: String!) { agentConnections(where: { membershipUserId: { eq: $userId } }) { id } }`,
    { userId },
  )
  // Literals, since a list of rows cannot travel as a variable
  const rows = capClientIds
    .slice(0, MAX_AGENT_CONNECTIONS - 1 - held.length)
    .map(
      clientId =>
        `{ membershipUserId: "${userId}", membershipOrganizationId: "${organizationId}", clientId: "${clientId}", module: "documents", scopes: ["documents:read"] }`,
    )

  await write(`mutation Fill { agentConnection_insertMany(data: [${rows.join(', ')}]) }`)

  const last = capClientIds[MAX_AGENT_CONNECTIONS - 1]!
  const past = capClientIds[MAX_AGENT_CONNECTIONS]!
  const lastRequest = await createRequest(last)

  check(
    'an Allow up to the cap goes through',
    (await refusal(approve(lastRequest, last, { scopes: ['documents:read', 'documents:write'] }).approval)) === null,
  )

  const pastRequest = await createRequest(past)
  const cause = await refusal(approve(pastRequest, past).approval)

  check(
    'an Allow past the cap is refused, as the backend reads it, and decides nothing',
    cause !== null
      && cause.includes('A member connects at most')
      && (
        await read<{ oAuthAuthorizationRequest: { decidedAt: string | null } | null }>(
          `query Decided($id: UUID!) { oAuthAuthorizationRequest(id: $id) { decidedAt } }`,
          { id: pastRequest },
        )
      ).oAuthAuthorizationRequest?.decidedAt === null,
  )
  check(
    'consenting again with an agent connected at the cap replaces it',
    (await refusal(approve(await createRequest(last), last, { scopes: ['documents:read'] }).approval)) === null
      && (await readConnections(last)).length === 1,
  )

  // Consents in two organizations at once, one below the cap: the member's row takes them in turn
  await write(
    `mutation Join($userId: String!, $organizationId: UUID!) {
      userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: MEMBER })
    }`,
    { userId, organizationId: otherOrganizationId },
  )

  let heldCap = true

  for (let round = 0; round < 5; round++) {
    await write(
      `mutation Free($userId: String!, $clientId: String!) {
        agentConnection_deleteMany(where: { membershipUserId: { eq: $userId }, clientId: { eq: $clientId } })
      }`,
      { userId, clientId: capClientIds[round]! },
    )

    const racing = [
      `https://check-${checkId}-race${round}a.example.com/agent.json`,
      `https://check-${checkId}-race${round}b.example.com/agent.json`,
    ]
    const requests = await Promise.all(racing.map(clientId => createRequest(clientId)))
    const causes = await Promise.all([
      refusal(approve(requests[0]!, racing[0]!).approval),
      refusal(approve(requests[1]!, racing[1]!, { organization: otherOrganizationId }).approval),
    ])
    const { agentConnections: connected } = await read<{ agentConnections: { id: string }[] }>(
      `query Held($userId: String!) { agentConnections(where: { membershipUserId: { eq: $userId } }) { id } }`,
      { userId },
    )

    capClientIds.push(...racing)

    if (causes.filter(cause => cause === null).length !== 1 || connected.length !== MAX_AGENT_CONNECTIONS) {
      heldCap = false
      console.log(`        ${causes.map(cause => cause ?? 'allowed').join(' / ')}, ${connected.length} connected`)
    }
  }

  check('consents in two organizations at once, one below the cap, let one through', heldCap)

  await write(
    `mutation Empty($userId: String!, $clientIds: [String!]!, $otherOrganizationId: UUID!) {
      agentConnection_deleteMany(where: { membershipUserId: { eq: $userId }, clientId: { in: $clientIds } })
      userOrganization_delete(key: { userId: $userId, organizationId: $otherOrganizationId })
    }`,
    { userId, clientIds: capClientIds, otherOrganizationId },
  )
}

async function checkTokens() {
  const clientId = `https://check-${checkId}.example.com/tokens.json`
  const otherClientId = `https://check-${checkId}.example.com/other.json`
  const requestId = await createRequest(clientId)
  const approval = approve(requestId, clientId)

  await approval.approval

  const first = exchange(requestId, approval.code, approval.connectionId)

  check('a code is exchanged once', (await refusal(first.exchange)) === null)
  check('the exchange stores an access and a refresh token', (await countTokens(approval.connectionId)) === 2)

  const again = exchange(requestId, approval.code, approval.connectionId)

  check('a code is refused a second exchange', (await refusal(again.exchange)) !== null)
  check('a refused exchange stores nothing', (await countTokens(approval.connectionId)) === 2)

  const { data: used } = await getOAuthAuthorizationRequestByCode(dataConnect, {
    codeHash: createHashOf(approval.code),
  })

  check('a used code reads as used', Boolean(used.oAuthAuthorizationRequests[0]?.codeUsedAt))

  // A refresh rotates once
  const { data: unspent } = await getAgentConnectionRefreshToken(dataConnect, {
    hash: createHashOf(first.refreshToken),
  })
  const refreshTokenId = unspent.token[0]?.id ?? ''

  check(
    'an unspent refresh token reads unspent',
    Boolean(refreshTokenId) && unspent.token[0]?.usedAt === null && unspent.recentlySpent.length === 0,
  )

  const rotate = () =>
    rotateAgentConnectionRefreshToken(dataConnect, {
      id: refreshTokenId,
      connectionId: approval.connectionId,
      resource,
      accessScopes: ['documents:read'],
      refreshScopes: READ_WRITE,
      successorKeyVersion: 1,
      accessTokenHash: createHashOf(createSecret()),
      refreshTokenHash: createHashOf(createSecret()),
    })
  const rotations = await Promise.all([refusal(rotate()), refusal(rotate())])

  check(
    'a refresh token rotates once, two refreshes at once included',
    rotations.filter(cause => cause === null).length === 1,
  )
  check('a rotation stores two successors', (await countTokens(approval.connectionId)) === 4)

  const { data: spent } = await getAgentConnectionRefreshToken(dataConnect, { hash: createHashOf(first.refreshToken) })

  check(
    'a token spent a moment ago reads as recently spent, with its version',
    spent.recentlySpent.length === 1 && spent.token[0]?.successorKeyVersion === 1,
  )

  // Revoking, and another connection's tokens left alone
  const otherRequestId = await createRequest(otherClientId)
  const other = approve(otherRequestId, otherClientId)

  await other.approval
  await exchange(otherRequestId, other.code, other.connectionId).exchange
  await revokeAgentConnection(dataConnect, { id: approval.connectionId })

  check('revoking a connection deletes its tokens', (await countTokens(approval.connectionId)) === 0)
  check("revoking a connection leaves another's tokens", (await countTokens(other.connectionId)) === 2)
  check(
    "a revoked connection's request opens nothing",
    (await getOAuthAuthorizationRequestByCode(dataConnect, { codeHash: createHashOf(approval.code) })).data
      .oAuthAuthorizationRequests[0]?.connection === null,
  )

  // Removing the member
  await write(
    `mutation RemoveMember($organizationId: UUID!, $userId: String!) {
      userOrganization_delete(key: { userId: $userId, organizationId: $organizationId })
    }`,
    { organizationId, userId },
  )

  check('removing the member deletes their connections', (await readConnections(otherClientId)).length === 0)
  check("removing the member deletes their connections' tokens", (await countTokens(other.connectionId)) === 0)
}

async function checkPrunes() {
  const clientId = `https://check-${checkId}-unserved.example.com/agent.json`

  // The other member's, since the member was removed, all made over a week ago but one: to a module
  // no endpoint serves, to one a newer release may serve, made a moment ago, and to a module served
  await write(
    `mutation Unserved($userId: String!, $organizationId: UUID!, $clientId: String!, $weekAgo: Timestamp!) {
      unserved: agentConnection_insert(data: { membershipUserId: $userId, membershipOrganizationId: $organizationId, clientId: $clientId, module: "retired", scopes: ["retired:read"], createdAt: $weekAgo })
      recent: agentConnection_insert(data: { membershipUserId: $userId, membershipOrganizationId: $organizationId, clientId: $clientId, module: "newer", scopes: ["newer:read"] })
      served: agentConnection_insert(data: { membershipUserId: $userId, membershipOrganizationId: $organizationId, clientId: $clientId, module: "documents", scopes: ["documents:read"], createdAt: $weekAgo })
    }`,
    {
      userId: otherUserId,
      organizationId,
      clientId,
      weekAgo: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
  )

  const prune = async () => {
    await pruneOAuthAuthorizationRequests(dataConnect)
    await pruneUnservedAgentConnections(dataConnect, { modules: [...SERVED_MODULE_NAMES] })
    await pruneAgentConnectionTokens(dataConnect)
    await pruneOAuthClients(dataConnect)
  }

  check('the sweep prunes go through', (await refusal(prune())) === null)
  check('the sweep prunes go through again', (await refusal(prune())) === null)

  const { agentConnections } = await read<{ agentConnections: { module: string }[] }>(
    `query Pruned($userId: String!, $clientId: String!) {
      agentConnections(where: { membershipUserId: { eq: $userId }, clientId: { eq: $clientId } }) { module }
    }`,
    { userId: otherUserId, clientId },
  )

  check(
    "the sweep deletes a connection to a module no endpoint serves idle for a week, and keeps a recent one and a served module's",
    agentConnections
      .map(({ module }) => module)
      .sort()
      .join() === 'documents,newer',
  )
}

try {
  await setUp()
  await checkFlow()
  await checkConsent()
  await checkConnectedAgents()
  await checkModuleEndpoint(TASKS_ENDPOINT)
  await checkModuleEndpoint(BUDGET_ENDPOINT)
  await checkConnectionCap()
  await checkTokens()
  await checkPrunes()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}

console.log('\nEvery check passed')
process.exit(0)
