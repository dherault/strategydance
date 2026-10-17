import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import express, { type NextFunction, type Request, type Response } from 'express'
import { CONVERSATION_SEARCH_WINDOW_MINUTES, MAX_CONVERSATION_SEARCHES } from 'strategydance-core'

import {
  MAX_MODULE_REQUESTS,
  MAX_REFUSED_MODULE_REQUESTS,
  MODULE_IDEMPOTENCY_KEY_META,
  MODULE_PROTOCOL_VERSION,
} from '~constants'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

const CLIENT_ID = 'https://client.example.com/oauth/metadata.json'

const fetchOutbound = mock(async (url: string) => ({
  url,
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: Buffer.from(
    JSON.stringify({
      client_id: url,
      client_name: 'Example Agent',
      redirect_uris: ['https://client.example.com/callback'],
      token_endpoint_auth_method: 'none',
    }),
  ),
  isTruncated: false,
}))

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('~utils/fetchOutbound', () => ({ default: fetchOutbound, OutboundRefusal: class extends Error {} }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/oauth/readOAuthTokenSecret', () => ({
  default: async (version?: number) => ({ value: 'secret', version: version ?? 1 }),
}))
mock.module('~middleware/appCheck', () => ({
  default: (_request: Request, _response: Response, next: NextFunction) => next(),
}))
mock.module('~middleware/authentication', () => ({
  default: (request: Request, _response: Response, next: NextFunction) => {
    request.viewer = { id: MEMBER, email: null }
    next()
  },
}))

const { default: createModuleMetadataRouter } = await import('./moduleMetadata')
const { default: createModulesRouter } = await import('./modules')
const { default: createOAuthRouter } = await import('./oauth')
const { default: createOAuthRequestsRouter } = await import('./oauthRequests')
const { default: createWellKnownRouter } = await import('./wellKnown')

const ISSUER = 'http://localhost:3003'
const KNOWLEDGE = `${ISSUER}/mcp/knowledge`
const TASKS = `${ISSUER}/mcp/tasks`
const RESOURCE_METADATA = `${ISSUER}/.well-known/oauth-protected-resource/mcp/knowledge`
const TASKS_RESOURCE_METADATA = `${ISSUER}/.well-known/oauth-protected-resource/mcp/tasks`
const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const MEMBER = 'member'
const REDIRECT_URI = 'https://client.example.com/callback'
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url')
const LEGACY_PROTOCOL_VERSION = '2025-11-25'

// Mounted as `createApp` mounts them on the public backend
const app = express()

// As `createApp` trusts Cloud Run's proxy, so a test calls from an address of its own
app.set('trust proxy', 1)
app.use('/.well-known', createWellKnownRouter())
app.use(createModuleMetadataRouter())
app.use('/oauth/requests', createOAuthRequestsRouter())
app.use('/oauth', createOAuthRouter())
app.use('/mcp', createModulesRouter())

const server: Server = app.listen(0)

await new Promise(resolve => server.once('listening', resolve))

const origin = `http://localhost:${(server.address() as AddressInfo).port}`

afterAll(() => {
  server.close()
})

type Tokens = { access_token: string; refresh_token: string; scope: string }

type Answer = { status: number; headers: Headers; body: Record<string, any> }

function encode(parameters: Record<string, string>) {
  return new URLSearchParams(parameters).toString()
}

// An agent the member connected, through the whole flow: authorization, Allow and the exchange
async function connect({
  scopes = ['knowledge:read', 'knowledge:write'],
  resource = KNOWLEDGE,
}: { scopes?: string[]; resource?: string } = {}) {
  const { data } = await (
    fake.sdk.createOAuthAuthorizationRequest as (
      ...args: unknown[]
    ) => Promise<{ data: { oAuthAuthorizationRequest_insert: { id: string } } }>
  )(
    {},
    {
      clientId: CLIENT_ID,
      registeredClientId: null,
      redirectUri: REDIRECT_URI,
      codeChallenge: CHALLENGE,
      resource,
      scopes,
      state: 'opaque state',
    },
  )
  const approved = await fetch(`${origin}/oauth/requests/${data.oAuthAuthorizationRequest_insert.id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: ORGANIZATION_ID, scopes }),
  })
  const { data: decision } = (await approved.json()) as { data: { redirectUrl: string } }
  const exchanged = await fetch(`${origin}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encode({
      grant_type: 'authorization_code',
      code: new URL(decision.redirectUrl).searchParams.get('code')!,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: VERIFIER,
      resource,
    }),
  })

  return (await exchanged.json()) as Tokens
}

// An external agent on a module's endpoint, as the SDK's client calls it over HTTP with its bearer token
async function open(token: string, path = '/mcp/knowledge') {
  const client = new Client(
    { name: 'external-agent', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: MODULE_PROTOCOL_VERSION } } },
  )

  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${origin}${path}`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  )

  return client
}

// One JSON-RPC request in a 2025 revision, which the handler serves statelessly, as raw HTTP, to the
// Knowledge module's endpoint unless `path` names another
async function send(
  message: Record<string, unknown>,
  {
    token,
    headers = {},
    method = 'POST',
    path = '/mcp/knowledge',
  }: { token?: string; headers?: Record<string, string>; method?: string; path?: string } = {},
): Promise<Answer> {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': LEGACY_PROTOCOL_VERSION,
      ...(token !== undefined && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(method !== 'GET' && method !== 'HEAD' && { body: JSON.stringify(message) }),
  })
  return { status: response.status, headers: response.headers, body: readBody(response.headers, await response.text()) }
}

// A JSON answer, or the message of a 2025 revision's answer, which the handler streams as events
function readBody(headers: Headers, text: string) {
  if (!text) return {}
  if (!headers.get('content-type')?.startsWith('text/event-stream')) return JSON.parse(text)

  const data = text
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trim())
    .filter(Boolean)

  return JSON.parse(data.at(-1)!)
}

function callTool(name: string, args: Record<string, unknown>) {
  return { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }
}

function documentsOfOrganization() {
  return [...fake.documents.values()].filter(document => document.organizationId === ORGANIZATION_ID)
}

function tasksOfOrganization() {
  return [...fake.tasks.values()].filter(task => task.organizationId === ORGANIZATION_ID)
}

beforeEach(() => {
  fake.reset()
  fake.addMember(MEMBER, ORGANIZATION_ID)
  fake.setStaff(MEMBER)
})

describe('the Knowledge module for external agents', () => {
  test("answers a request without a token 401, naming the module's protected resource metadata", async () => {
    const { status, headers, body } = await send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })

    expect(status).toBe(401)
    expect(body.error).toBe('invalid_token')
    expect(headers.get('www-authenticate')).toContain(`resource_metadata="${RESOURCE_METADATA}"`)
  })

  test('serves the protected resource metadata at the root, naming the authorization server', async () => {
    const response = await fetch(`${origin}/.well-known/oauth-protected-resource/mcp/knowledge`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      resource: KNOWLEDGE,
      authorization_servers: [ISSUER],
      scopes_supported: ['knowledge:read', 'knowledge:write'],
      resource_name: 'Strategy Dance Knowledge',
    })
    expect(
      ((await (await fetch(`${origin}/.well-known/oauth-authorization-server`)).json()) as { issuer: string }).issuer,
    ).toBe(ISSUER)
  })

  test("serves a valid access token's calls as its member, through the SDK's client", async () => {
    const tokens = await connect()
    const client = await open(tokens.access_token)

    expect((await client.listTools()).tools).toHaveLength(8)

    const created = await client.callTool({
      name: 'create_document',
      arguments: { title: 'Launch plan', aspects: ['MARKETING'], content: 'We launch in spring.' },
    })

    expect(created.isError).toBeFalsy()
    expect(created.structuredContent).toMatchObject({ title: 'Launch plan' })
    expect((created.structuredContent as { url: string }).url).toStartWith(`http://localhost:5173/${ORGANIZATION_ID}/`)

    const found = await client.callTool({ name: 'search_documents', arguments: { query: 'launch' } })

    expect((found.structuredContent as { documents: unknown[] }).documents).toHaveLength(1)

    await client.close()
  })

  test("refuses a Tasks token, a revoked one, a removed member's and a refresh token as a bearer token", async () => {
    const tasks = await connect({ scopes: ['tasks:read'], resource: TASKS })
    const knowledge = await connect()
    const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' }

    for (const token of [tasks.access_token, knowledge.refresh_token]) {
      const { status, headers } = await send(list, { token })

      expect(status).toBe(401)
      expect(headers.get('www-authenticate')).toContain(`resource_metadata="${RESOURCE_METADATA}"`)
    }

    expect((await send(list, { token: knowledge.access_token })).status).toBe(200)

    await fetch(`${origin}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encode({ token: knowledge.refresh_token, client_id: CLIENT_ID }),
    })

    expect((await send(list, { token: knowledge.access_token })).status).toBe(401)

    const removed = await connect()

    fake.removeMember(MEMBER, ORGANIZATION_ID)

    expect((await send(list, { token: removed.access_token })).status).toBe(401)
  })

  test("challenges a read-only connection's writes, still listing them, until a new consent allows them", async () => {
    const readOnly = await connect({ scopes: ['knowledge:read'] })

    expect(readOnly.scope).toBe('knowledge:read')

    const listed = await send({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { token: readOnly.access_token })

    expect(listed.body.result.tools.map((tool: { name: string }) => tool.name)).toContain('create_document')

    const challenged = await send(callTool('create_document', { title: 'New', aspects: [], content: 'Text' }), {
      token: readOnly.access_token,
    })

    expect(challenged.status).toBe(403)
    expect(challenged.body.error).toBe('insufficient_scope')
    expect(challenged.headers.get('www-authenticate')).toContain('error="insufficient_scope"')
    expect(challenged.headers.get('www-authenticate')).toContain('scope="knowledge:write"')
    expect(challenged.headers.get('www-authenticate')).toContain(`resource_metadata="${RESOURCE_METADATA}"`)
    expect(documentsOfOrganization()).toEqual([])

    const readWrite = await connect({ scopes: ['knowledge:read', 'knowledge:write'] })

    expect(fake.connectionsOf(MEMBER, ORGANIZATION_ID)).toHaveLength(1)
    expect((await send({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { token: readOnly.access_token })).status).toBe(
      401,
    )

    const written = await send(callTool('create_document', { title: 'New', aspects: [], content: 'Text' }), {
      token: readWrite.access_token,
    })

    expect(written.status).toBe(200)
    expect(written.body.result.isError).toBeFalsy()
    expect(documentsOfOrganization()).toHaveLength(1)
  })

  test('applies a write retried with its key once, under the connection', async () => {
    const client = await open((await connect()).access_token)
    const write = {
      name: 'create_document',
      arguments: { title: 'Once', aspects: [], content: 'Written once.' },
      _meta: { [MODULE_IDEMPOTENCY_KEY_META]: 'retried' },
    }

    const first = await client.callTool(write)
    const second = await client.callTool(write)

    expect(second.structuredContent).toEqual(first.structuredContent)
    expect(documentsOfOrganization()).toHaveLength(1)

    const [connection] = fake.connectionsOf(MEMBER, ORGANIZATION_ID)

    expect([...fake.results.values()].map(result => result.idempotencyScope)).toEqual([`connection:${connection!.id}`])

    await client.close()
  })

  test("answers an Origin other than the app's 403, and serves one from the app or none", async () => {
    const { access_token: token } = await connect()
    const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    const elsewhere = await send(list, { token, headers: { Origin: 'https://elsewhere.example' } })

    expect(elsewhere.status).toBe(403)
    expect(elsewhere.body.jsonrpc).toBe('2.0')
    expect((await send(list, { token, headers: { Origin: 'http://localhost:5173' } })).status).toBe(200)
    expect((await send(list, { token })).status).toBe(200)
  })

  test("hands a POST's JSON body to the handler whole, past the parser's default limit", async () => {
    const { access_token: token } = await connect()
    const text = 'Grüße aus Tōkyō 🌸, he said "hello" and left. '.repeat(3000).trim()
    const written = await send(callTool('create_document', { title: 'Long', aspects: [], content: text }), { token })

    expect(Buffer.byteLength(text)).toBeGreaterThan(100 * 1024)
    expect(written.status).toBe(200)
    expect(written.body.result.isError).toBeFalsy()
    expect(documentsOfOrganization()[0]!.contentText).toBe(text)
  })

  test("serves a 2025-11-25 client's initialize, and its session header, statelessly", async () => {
    const { access_token: token } = await connect()
    const initialized = await send(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: LEGACY_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'legacy-agent', version: '1.0.0' },
        },
      },
      { token },
    )

    expect(initialized.status).toBe(200)
    expect(initialized.body.result.protocolVersion).toBe(LEGACY_PROTOCOL_VERSION)
    expect(initialized.body.result.serverInfo.name).toBeString()

    const listed = await send(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { token, headers: { 'Mcp-Session-Id': initialized.headers.get('mcp-session-id') ?? 'a-session-of-its-own' } },
    )

    expect(listed.status).toBe(200)
    expect(listed.body.result.tools).toHaveLength(8)
  })

  test("answers a search past the member's allowance with a result saying so", async () => {
    const { access_token: token } = await connect()

    for (let index = 0; index < MAX_CONVERSATION_SEARCHES; index++) {
      fake.searches.push({ userId: MEMBER, organizationId: ORGANIZATION_ID, createdAt: new Date().toISOString() })
    }

    const { status, body } = await send(callTool('search_documents', { query: 'plan' }), { token })

    expect(status).toBe(200)
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain(
      `limited to ${MAX_CONVERSATION_SEARCHES} in ${CONVERSATION_SEARCH_WINDOW_MINUTES} minutes`,
    )
  })

  test('answers GET and DELETE 405, a body that is not JSON 400 and one past 1 MiB 413, in JSON-RPC', async () => {
    const { access_token: token } = await connect()

    for (const method of ['GET', 'DELETE']) {
      const { status, headers, body } = await send({}, { method })

      expect(status).toBe(405)
      expect(headers.get('allow')).toBe('POST')
      expect(body.jsonrpc).toBe('2.0')
    }

    const malformed = await fetch(`${origin}/mcp/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{"jsonrpc": "2.0",',
    })

    expect(malformed.status).toBe(400)
    expect(((await malformed.json()) as { error: { code: number } }).error.code).toBe(-32700)

    const oversized = await send(
      callTool('create_document', { title: 'Big', aspects: [], content: 'a'.repeat(1100000) }),
      {
        token,
      },
    )

    expect(oversized.status).toBe(413)
    expect(oversized.body.error.code).toBe(-32000)
    expect(documentsOfOrganization()).toEqual([])
  })

  test('marks the connection used once across calls within a minute', async () => {
    const { access_token: token } = await connect()
    const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' }

    fake.calls.length = 0

    await send(list, { token })
    await send(list, { token })

    const [connection] = fake.connectionsOf(MEMBER, ORGANIZATION_ID)

    expect(connection!.lastUsedAt).not.toBeNull()
    expect(fake.calls.filter(name => name === 'RecordAgentConnectionUse')).toHaveLength(1)
  })

  test('meters each connection apart, answering past its calls 429 in JSON-RPC', async () => {
    const busy = await connect()
    const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    const address = { 'X-Forwarded-For': '203.0.113.9' }

    for (let index = 0; index < MAX_MODULE_REQUESTS; index++) {
      expect((await send(list, { token: busy.access_token, headers: address })).status).toBe(200)
    }

    const limited = await send(list, { token: busy.access_token, headers: address })

    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe(-32000)

    // Another connection, the member's after they were removed and invited back
    fake.removeMember(MEMBER, ORGANIZATION_ID)
    fake.addMember(MEMBER, ORGANIZATION_ID)

    const fresh = await connect()

    expect((await send(list, { token: fresh.access_token, headers: address })).status).toBe(200)
  })

  test('meters refused calls per address before any token is read, never the calls it serves', async () => {
    const { access_token: token } = await connect()
    const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    const address = { 'X-Forwarded-For': '203.0.113.7' }

    for (let index = 0; index < MAX_REFUSED_MODULE_REQUESTS - 1; index++) {
      expect((await send(list, { token: 'made-up', headers: address })).status).toBe(401)
    }
    for (let index = 0; index < 5; index++) expect((await send(list, { token, headers: address })).status).toBe(200)

    expect((await send(list, { token: 'made-up', headers: address })).status).toBe(401)

    fake.calls.length = 0

    const limited = await send(list, { token: 'made-up', headers: address })

    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe(-32000)
    expect(fake.calls).not.toContain('GetAgentConnectionAccessToken')
    expect((await send(list, { token, headers: address })).status).toBe(429)
    expect((await send(list, { token, headers: { 'X-Forwarded-For': '203.0.113.8' } })).status).toBe(200)
  })
})

describe('the Tasks module for external agents', () => {
  const TASKS_PATH = '/mcp/tasks'
  const READ_WRITE = ['tasks:read', 'tasks:write']
  const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' }

  test("serves its protected resource metadata at the root, beside the Knowledge module's", async () => {
    const response = await fetch(`${origin}/.well-known/oauth-protected-resource/mcp/tasks`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      resource: TASKS,
      authorization_servers: [ISSUER],
      scopes_supported: ['tasks:read', 'tasks:write'],
      resource_name: 'Strategy Dance Tasks',
    })
  })

  test("answers no token and a Knowledge token 401, naming the Tasks module's protected resource metadata", async () => {
    const knowledge = await connect()

    for (const token of [undefined, knowledge.access_token]) {
      const { status, headers } = await send(list, { token, path: TASKS_PATH })

      expect(status).toBe(401)
      expect(headers.get('www-authenticate')).toContain(`resource_metadata="${TASKS_RESOURCE_METADATA}"`)
    }

    const tasks = await connect({ scopes: READ_WRITE, resource: TASKS })

    expect((await send(list, { token: tasks.access_token, path: TASKS_PATH })).status).toBe(200)
  })

  test("serves a valid access token's calls as its member, its results carrying the tasks' addresses", async () => {
    const client = await open((await connect({ scopes: READ_WRITE, resource: TASKS })).access_token, TASKS_PATH)

    expect((await client.listTools()).tools).toHaveLength(8)

    const created = await client.callTool({ name: 'create_task', arguments: { name: 'Launch plan', status: 'TODO' } })
    const { id, url } = created.structuredContent as { id: string; url: string }

    expect(created.isError).toBeFalsy()
    expect(url).toBe(`http://localhost:5173/${ORGANIZATION_ID}/tasks/${id}`)
    expect(tasksOfOrganization()).toHaveLength(1)

    const listed = await client.callTool({ name: 'list_tasks', arguments: { query: 'launch' } })
    const read = await client.callTool({ name: 'read_task', arguments: { id } })

    expect((listed.structuredContent as { tasks: unknown[] }).tasks).toEqual([expect.objectContaining({ id, url })])
    expect(read.structuredContent).toMatchObject({ id, url })

    await client.close()
  })

  test("challenges a read-only connection's writes, still listing them, until a new consent allows them", async () => {
    const readOnly = await connect({ scopes: ['tasks:read'], resource: TASKS })

    expect(readOnly.scope).toBe('tasks:read')

    const listed = await send(list, { token: readOnly.access_token, path: TASKS_PATH })

    expect(listed.body.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'list_tasks',
      'read_task',
      'create_task',
      'update_task',
      'add_task_dependency',
      'remove_task_dependency',
      'delete_task',
      'restore_task',
    ])

    const challenged = await send(callTool('create_task', { name: 'New', status: 'TODO' }), {
      token: readOnly.access_token,
      path: TASKS_PATH,
    })

    expect(challenged.status).toBe(403)
    expect(challenged.body.error).toBe('insufficient_scope')
    expect(challenged.headers.get('www-authenticate')).toContain('error="insufficient_scope"')
    expect(challenged.headers.get('www-authenticate')).toContain('scope="tasks:write"')
    expect(challenged.headers.get('www-authenticate')).toContain(`resource_metadata="${TASKS_RESOURCE_METADATA}"`)
    expect(tasksOfOrganization()).toEqual([])

    const readWrite = await connect({ scopes: READ_WRITE, resource: TASKS })
    const written = await send(callTool('create_task', { name: 'New', status: 'TODO' }), {
      token: readWrite.access_token,
      path: TASKS_PATH,
    })

    expect(written.status).toBe(200)
    expect(written.body.result.isError).toBeFalsy()
    expect(tasksOfOrganization()).toHaveLength(1)
  })

  test("keeps a client's Knowledge and Tasks connections apart, revoking one leaving the other", async () => {
    const knowledge = await connect()
    const tasks = await connect({ scopes: READ_WRITE, resource: TASKS })

    expect(fake.connectionsOf(MEMBER, ORGANIZATION_ID)).toHaveLength(2)

    await fetch(`${origin}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encode({ token: tasks.refresh_token, client_id: CLIENT_ID }),
    })

    expect((await send(list, { token: tasks.access_token, path: TASKS_PATH })).status).toBe(401)
    expect((await send(list, { token: knowledge.access_token })).status).toBe(200)
  })

  test("answers a query past the member's allowance with a result saying so, and never counts a list without one", async () => {
    const { access_token: token } = await connect({ scopes: READ_WRITE, resource: TASKS })
    const unfiltered = await send(callTool('list_tasks', {}), { token, path: TASKS_PATH })

    expect(unfiltered.body.result.isError).toBeFalsy()
    expect(fake.searches).toEqual([])

    for (let index = 0; index < MAX_CONVERSATION_SEARCHES; index++) {
      fake.searches.push({ userId: MEMBER, organizationId: ORGANIZATION_ID, createdAt: new Date().toISOString() })
    }

    const { status, body } = await send(callTool('list_tasks', { query: 'plan' }), { token, path: TASKS_PATH })

    expect(status).toBe(200)
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain(
      `limited to ${MAX_CONVERSATION_SEARCHES} in ${CONVERSATION_SEARCH_WINDOW_MINUTES} minutes`,
    )
    expect((await send(callTool('list_tasks', {}), { token, path: TASKS_PATH })).body.result.isError).toBeFalsy()
  })
})

describe('the Subagents module', () => {
  test('is served to no external agent: no endpoint, and no protected resource metadata', async () => {
    const { access_token: token } = await connect()
    const call = await fetch(`${origin}/mcp/subagents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })

    expect(call.status).toBe(404)
    expect((await fetch(`${origin}/.well-known/oauth-protected-resource/mcp/subagents`)).status).toBe(404)
  })
})
