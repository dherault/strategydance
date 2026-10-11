import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import { DEVELOPMENT_API_URL } from 'strategydance-core'
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
  revokeAgentConnection,
  rotateAgentConnectionRefreshToken,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { authentication, dataConnect } from '~firebase'

import createAgentConnectionTokenVerifier from '~domain/oauth/createAgentConnectionTokenVerifier'
import isMembershipRefusal from '~domain/oauth/isMembershipRefusal'

import readModuleCaller from '~modules/readModuleCaller'

/*
  Checks the authorization server against the local backend and the emulators, where CI cannot:

    bun run check:oauth

  First the whole flow, as an external agent and a member would go through it, against the backend
  at `API_URL`, `bun run dev:backend` unless it says otherwise: it registers a loopback client,
  authorizes, approves as an account signed in to the Auth emulator, exchanges the code, has the
  token verifier take the access token, refreshes, presents the spent refresh token again, and
  revokes.

  Then what guards it in its operations' SQL conditions: a request decided once, a code used once, a
  refresh token rotated once, one connection per member, client and module, and the cascades that
  take a connection's tokens with it, calling the backend connector's own operations as the
  endpoints call them, at once where two requests could race. The domain's tests run against a fake
  of these operations: this is what says the fake's conditions are the SQL's.

  It makes a throwaway organization with a member, removes everything it made, then exits non-zero
  naming each check that failed. The sweep's deletes take no organization: they remove every expired
  request and token, and every unused registration, in the emulator.

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
const resource = 'http://localhost:3003/mcp/knowledge'
const READ_WRITE = ['knowledge:read', 'knowledge:write']

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
  await webConnector.executeMutation(
    'CreateCurrentUser',
    { locale: 'EN', authenticationProviders: [] },
    { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } },
  )
  await write(
    `mutation SetUp($organizationId: UUID!, $otherOrganizationId: UUID!, $userId: String!) {
      organization_insert(data: { id: $organizationId, name: "Checked organization" })
      other: organization_insert(data: { id: $otherOrganizationId, name: "Another organization" })
      userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: MEMBER })
      user_update(id: $userId, data: { isAdministrator: true })
    }`,
    { organizationId, otherOrganizationId, userId },
  )
}

async function tearDown() {
  await write(
    `mutation TearDown(
      $organizationId: UUID!
      $otherOrganizationId: UUID!
      $userId: String!
      $clientIds: [String!]!
      $registeredClientIds: [UUID!]!
    ) {
      organization_delete(id: $organizationId)
      other: organization_delete(id: $otherOrganizationId)
      user_delete(id: $userId)
      oAuthAuthorizationRequest_deleteMany(where: { clientId: { in: $clientIds } })
      oAuthClient_deleteMany(where: { id: { in: $registeredClientIds } })
    }`,
    {
      organizationId,
      otherOrganizationId,
      userId,
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

async function checkFlow() {
  const metadata = await readMetadata()
  const resource = `${metadata.issuer}/mcp/knowledge`
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

  // It asks for the member's knowledge, which sends the browser to the consent page
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

  // The member reads it and allows it
  const headers = { Authorization: `Bearer ${await signIn()}`, 'Content-Type': 'application/json' }
  const reading = await fetch(`${apiUrl}/oauth/requests/${requestId}`, { headers })
  const { data: summary } = (await reading.json()) as {
    data?: { module: string; client: { isVerified: boolean }; isLoopbackRedirect: boolean; scopes: string[] }
  }

  check(
    'the consent page reads the request: the module, an unverified client, a loopback address, the access asked',
    reading.status === 200
      && summary?.module === 'knowledge'
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
  const knowledgeVerifier = createAgentConnectionTokenVerifier(new URL(resource))
  const tasksVerifier = createAgentConnectionTokenVerifier(new URL(`${metadata.issuer}/mcp/tasks`))
  const authInfo = await knowledgeVerifier.verifyAccessToken(tokens.access_token).catch(() => null)

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
    (await refusal(knowledgeVerifier.verifyAccessToken(tokens.refresh_token))) !== null,
  )

  // The client refreshes, and its spent token comes back
  const refresh = (refreshToken: string) =>
    token({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, resource })
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

  // The client revokes
  const revocation = await fetch(metadata.revocation_endpoint, {
    method: 'POST',
    headers: form,
    body: new URLSearchParams({ token: rotated.refresh_token, client_id: clientId }),
  })

  check('a refresh token is revoked', revocation.status === 200)
  check('a revoked refresh token is refused', (await refresh(rotated.refresh_token)).status === 400)
  check(
    "the revoked connection's access token is refused",
    (await refusal(knowledgeVerifier.verifyAccessToken(rotated.access_token))) !== null,
  )
}

// A pending request a client made, asking for read and write unless told otherwise
async function createRequest(clientId: string, scopes = READ_WRITE) {
  clientIds.add(clientId)

  const { data } = await createOAuthAuthorizationRequest(dataConnect, {
    clientId,
    registeredClientId: null,
    redirectUri: 'http://127.0.0.1:43210/callback',
    codeChallenge: createHashOf(createSecret()),
    resource,
    scopes,
    state: 'checked',
  })

  return data.oAuthAuthorizationRequest_insert.id
}

// Allows a request as the member, answering the connection's id and the code
function approve(
  requestId: string,
  clientId: string,
  { scopes = READ_WRITE, organization = organizationId }: { scopes?: string[]; organization?: string } = {},
) {
  const connectionId = createId()
  const code = createSecret()

  return {
    connectionId,
    code,
    approval: approveOAuthAuthorizationRequest(dataConnect, {
      id: requestId,
      userId,
      organizationId: organization,
      connectionId,
      clientId,
      registeredClientId: null,
      clientName: 'Checked client',
      module: 'knowledge',
      resource,
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

function exchange(requestId: string, code: string, connectionId: string) {
  const accessToken = createSecret()
  const refreshToken = createSecret()

  return {
    accessToken,
    refreshToken,
    exchange: exchangeOAuthAuthorizationCode(dataConnect, {
      id: requestId,
      codeHash: createHashOf(code),
      connectionId,
      resource,
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

  const second = await createRequest(clientId, ['knowledge:read'])
  const secondApproval = approve(second, clientId, { scopes: ['knowledge:read'] })

  check('consenting again goes through', (await refusal(secondApproval.approval)) === null)

  const connections = await readConnections(clientId)

  check(
    'consenting again replaces the connection with one of the access last allowed',
    connections.length === 1
      && connections[0]?.id === secondApproval.connectionId
      && connections[0].scopes.join() === 'knowledge:read',
  )

  const { data: replaced } = await getOAuthAuthorizationRequestByCode(dataConnect, {
    codeHash: createHashOf(firstApproval.code),
  })

  check("the replaced connection's code opens nothing", replaced.oAuthAuthorizationRequests[0]?.connection === null)
  check(
    "the replaced connection's code is refused at the exchange",
    (await refusal(exchange(first, firstApproval.code, firstApproval.connectionId).exchange)) !== null,
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
  const readOnly = await createRequest(clientId, ['knowledge:read'])

  check(
    'an Allow granting a scope the request did not ask for is refused',
    (await refusal(approve(readOnly, clientId).approval)) !== null,
  )
  const outsider = await refusal(
    approve(readOnly, clientId, { scopes: ['knowledge:read'], organization: otherOrganizationId }).approval,
  )

  check(
    'an Allow for an organization the account is not in is refused, as the backend reads a membership refusal',
    outsider !== null && isMembershipRefusal(outsider),
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
  const prune = async () => {
    await pruneOAuthAuthorizationRequests(dataConnect)
    await pruneAgentConnectionTokens(dataConnect)
    await pruneOAuthClients(dataConnect)
  }

  check('the sweep prunes go through', (await refusal(prune())) === null)
  check('the sweep prunes go through again', (await refusal(prune())) === null)
}

try {
  await setUp()
  await checkFlow()
  await checkConsent()
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
