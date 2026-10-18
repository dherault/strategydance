import { afterAll, afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'
import { createHash } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express, { type NextFunction, type Request, type Response } from 'express'
import {
  ERROR_CODE_TOO_MANY_AGENT_CONNECTIONS,
  ERROR_CODE_UNAUTHORIZED_AUTHENTICATION,
  MAX_AGENT_CONNECTIONS,
} from 'strategydance-core'

import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'
import createOAuthDatabaseFake from '~domain/oauth/testing/createOAuthDatabaseFake'

const fake = createOAuthDatabaseFake(createModuleDatabaseFakeBase())

// The client ID metadata documents on the web, by address
const documents = new Map<string, unknown>()

const fetchOutbound = mock(async (url: string) => {
  const document = documents.get(url)

  return {
    url,
    status: document ? 200 : 404,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(document ? JSON.stringify(document) : ''),
    isTruncated: false,
  }
})

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('~utils/fetchOutbound', () => ({ default: fetchOutbound, OutboundRefusal: class extends Error {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~middleware/appCheck', () => ({
  default: (_request: Request, _response: Response, next: NextFunction) => next(),
}))

// The caller the request names, or nobody, refused as the real middleware refuses a request with no
// token
mock.module('~middleware/authentication', () => ({
  default: (request: Request, response: Response, next: NextFunction) => {
    const viewer = request.header('x-viewer')

    if (!viewer) {
      response.status(401).json({ status: 'error', code: ERROR_CODE_UNAUTHORIZED_AUTHENTICATION, message: 'No token' })

      return
    }

    request.viewer = { id: viewer, email: null, isEmailVerified: true }
    next()
  },
}))

const { default: createOAuthRequestsRouter } = await import('./oauthRequests')

const ISSUER = 'http://localhost:3003'
const KNOWLEDGE = `${ISSUER}/mcp/knowledge`
const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const OTHER_ORGANIZATION_ID = '1f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const MEMBER = 'member'
const CLIENT_ID_URL = 'https://client.example.com/oauth/metadata.json'
const CHALLENGE = createHash('sha256').update('verifier'.repeat(6)).digest('base64url')

const app = express()

app.use('/oauth/requests', createOAuthRequestsRouter())

const server: Server = app.listen(0)

await new Promise(resolve => server.once('listening', resolve))

const origin = `http://localhost:${(server.address() as AddressInfo).port}`

afterAll(() => {
  server.close()
})

type Answer<Data> = { status: 'success'; data: Data } | { status: 'error'; code: string; message: string }

async function call<Data>(
  path: string,
  { method = 'GET', body, viewer = MEMBER }: { method?: string; body?: unknown; viewer?: string | null } = {},
) {
  const response = await fetch(`${origin}/oauth/requests/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(viewer ? { 'x-viewer': viewer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return { status: response.status, answer: (await response.json()) as Answer<Data> }
}

function approve(requestId: string, scopes = ['knowledge:read', 'knowledge:write'], organizationId = ORGANIZATION_ID) {
  return call<{ redirectUrl: string }>(`${requestId}/approve`, { method: 'POST', body: { organizationId, scopes } })
}

function deny(requestId: string) {
  return call<{ redirectUrl: string | null }>(`${requestId}/deny`, { method: 'POST' })
}

// A request an external agent made, as `GET /oauth/authorize` stores one
async function createRequest({
  clientId = CLIENT_ID_URL,
  redirectUri = 'https://client.example.com/callback',
  scopes = ['knowledge:read', 'knowledge:write'],
}: { clientId?: string; redirectUri?: string; scopes?: string[] } = {}) {
  const { data } = await (
    fake.sdk.createOAuthAuthorizationRequest as (
      ...args: unknown[]
    ) => Promise<{ data: { oAuthAuthorizationRequest_insert: { id: string } } }>
  )(
    {},
    {
      clientId,
      registeredClientId: /^[0-9a-f]{32}$/.test(clientId) ? clientId : null,
      redirectUri,
      codeChallenge: CHALLENGE,
      resource: KNOWLEDGE,
      scopes,
      state: 'opaque state',
    },
  )

  return data.oAuthAuthorizationRequest_insert.id
}

async function registerClient() {
  const { data } = await (
    fake.sdk.createOAuthClient as (...args: unknown[]) => Promise<{ data: { oAuthClient_insert: { id: string } } }>
  )(
    {},
    {
      name: 'Cursor',
      redirectUris: ['http://127.0.0.1/callback'],
    },
  )

  return data.oAuthClient_insert.id
}

function publishDocument(clientId = CLIENT_ID_URL, fields: Record<string, unknown> = {}) {
  documents.set(clientId, {
    client_id: clientId,
    client_name: 'Example Agent',
    redirect_uris: ['https://client.example.com/callback'],
    token_endpoint_auth_method: 'none',
    ...fields,
  })
}

let documentCount = 0

// A client ID metadata document of its own, since the documents read are kept for the whole file
function createDocumentClient(fields: Record<string, unknown> = {}) {
  documentCount++

  const clientId = `https://client${documentCount}.example.com/oauth/metadata.json`

  publishDocument(clientId, fields)

  return clientId
}

function readParameters(url: string) {
  return Object.fromEntries(new URL(url).searchParams)
}

beforeEach(() => {
  fake.reset()
  fetchOutbound.mockClear()
  documents.clear()
  fake.addMember(MEMBER, ORGANIZATION_ID)
  publishDocument()
})

afterEach(() => {
  setSystemTime()
})

describe('GET /oauth/requests/:requestId', () => {
  test('refuses a caller who has not signed in, fetching nothing', async () => {
    const requestId = await createRequest()

    expect((await call(requestId, { viewer: null })).status).toBe(401)
    expect(fetchOutbound).not.toHaveBeenCalled()
  })

  test('meters a caller before anything is read', async () => {
    const unknown = 'fedcba9876543210fedcba9876543210'

    for (let index = 0; index < 60; index++) expect((await call(unknown, { viewer: 'outsider' })).status).toBe(404)

    const reads = fake.calls.length

    expect((await call(unknown, { viewer: 'outsider' })).status).toBe(429)
    expect(fake.calls).toHaveLength(reads)
  })

  test("fetches a client ID metadata document once a member reads the request, and shows the client's domain", async () => {
    const clientId = createDocumentClient({ client_name: 'Example‮ Agent' })
    const requestId = await createRequest({ clientId })

    expect(await call(requestId)).toEqual({
      status: 200,
      answer: {
        status: 'success',
        data: {
          client: { name: 'Example Agent', isVerified: true, domain: `client${documentCount}.example.com` },
          redirectHost: 'client.example.com',
          isLoopbackRedirect: false,
          module: 'knowledge',
          scopes: ['knowledge:read', 'knowledge:write'],
          expiresAt: expect.any(String),
        },
      },
    })
    expect(fetchOutbound).toHaveBeenCalledTimes(1)
    expect(fetchOutbound).toHaveBeenCalledWith(clientId, expect.objectContaining({ maxRedirects: 0 }))

    await call(requestId)

    expect(fetchOutbound).toHaveBeenCalledTimes(1)
  })

  test('shows a registered client unverified, and its loopback address with the port it named', async () => {
    const clientId = await registerClient()
    const requestId = await createRequest({ clientId, redirectUri: 'http://127.0.0.1:43210/callback' })
    const { answer } = await call<{ client: unknown; redirectHost: string; isLoopbackRedirect: boolean }>(requestId)

    expect(answer).toEqual({
      status: 'success',
      data: expect.objectContaining({
        client: { name: 'Cursor', isVerified: false, domain: null },
        redirectHost: '127.0.0.1:43210',
        isLoopbackRedirect: true,
      }),
    })
    expect(fetchOutbound).not.toHaveBeenCalled()
  })

  test('refuses a client whose document does not declare the redirect address, or cannot be read', async () => {
    const undeclared = await createRequest({
      clientId: createDocumentClient(),
      redirectUri: 'https://client.example.com/elsewhere',
    })
    const unreadable = await createRequest({ clientId: 'https://missing.example.com/oauth/metadata.json' })

    for (const requestId of [undeclared, unreadable]) {
      const { status, answer } = await call(requestId)

      expect(status).toBe(400)
      expect(answer).toEqual(expect.objectContaining({ code: 'OAUTH_CLIENT_REFUSED' }))
    }
  })

  test('answers 404 for a request unknown or expired', async () => {
    const requestId = await createRequest()

    expect((await call('fedcba9876543210fedcba9876543210')).status).toBe(404)

    setSystemTime(Date.now() + 11 * 60 * 1000)

    expect((await call(requestId)).status).toBe(404)
  })
})

describe('POST /oauth/requests/:requestId/approve', () => {
  test('makes a connection and a code, and sends the browser back with code, state and the exact iss', async () => {
    const requestId = await createRequest()
    const { status, answer } = await approve(requestId)
    const redirectUrl = answer.status === 'success' ? answer.data.redirectUrl : ''
    const [connection] = fake.connections.values()

    expect(status).toBe(200)
    expect(redirectUrl).toStartWith('https://client.example.com/callback?')
    expect(readParameters(redirectUrl)).toEqual({
      code: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      state: 'opaque state',
      iss: ISSUER,
    })
    expect(connection).toEqual(
      expect.objectContaining({
        userId: MEMBER,
        organizationId: ORGANIZATION_ID,
        clientId: CLIENT_ID_URL,
        clientName: 'Example Agent',
        module: 'knowledge',
        scopes: ['knowledge:read', 'knowledge:write'],
      }),
    )
    expect(fake.requests.get(requestId)?.codeHash).toBe(
      createHash('sha256').update(readParameters(redirectUrl).code!).digest('base64url'),
    )
  })

  test('lets the member reduce read and write to read', async () => {
    const requestId = await createRequest()

    expect((await approve(requestId, ['knowledge:read'])).status).toBe(200)
    expect([...fake.connections.values()][0]?.scopes).toEqual(['knowledge:read'])
  })

  test('refuses read and write for a request that asked for read, and write without read', async () => {
    const readOnly = await createRequest({ scopes: ['knowledge:read'] })
    const both = await createRequest()

    expect((await approve(readOnly)).status).toBe(400)
    expect((await approve(both, ['knowledge:write'])).status).toBe(400)
    expect((await approve(both, ['knowledge:read', 'tasks:read'])).status).toBe(400)
    expect(fake.connections.size).toBe(0)
  })

  test('refuses an organization the caller is not in', async () => {
    const requestId = await createRequest()

    expect((await approve(requestId, undefined, OTHER_ORGANIZATION_ID)).status).toBe(403)
    expect(fake.connections.size).toBe(0)
    expect(fake.requests.get(requestId)?.decidedAt).toBeNull()
  })

  test('decides a request once: Allow sent twice makes one connection and one code', async () => {
    const requestId = await createRequest()
    const answers = await Promise.all([approve(requestId), approve(requestId)])

    expect(answers.map(({ status }) => status).sort()).toEqual([200, 404])
    expect(fake.connections.size).toBe(1)
    expect([...fake.requests.values()].filter(({ codeHash }) => codeHash)).toHaveLength(1)
  })

  test('decides a request once when an Allow races a Deny, and refuses a later Allow of a denied one', async () => {
    const raced = await createRequest()
    const answers = await Promise.all([approve(raced), deny(raced)])

    expect(answers.map(({ status }) => status).sort()).toEqual([200, 404])

    const denied = await createRequest()

    expect((await deny(denied)).status).toBe(200)
    expect((await approve(denied)).status).toBe(404)
  })

  test('replaces the earlier connection, with its tokens, when the member consents again', async () => {
    await approve(await createRequest())

    const [earlier] = fake.connections.values()

    fake.tokens.set('token', {
      id: 'token',
      connectionId: earlier!.id,
      kind: 'ACCESS',
      hash: 'hash',
      resource: KNOWLEDGE,
      scopes: ['knowledge:read'],
      issuedFrom: 'request',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      usedAt: null,
      successorKeyVersion: null,
      createdAt: new Date().toISOString(),
    })

    expect((await approve(await createRequest(), ['knowledge:read'])).status).toBe(200)

    const connections = [...fake.connections.values()]

    expect(connections).toHaveLength(1)
    expect(connections[0]?.id).not.toBe(earlier?.id)
    expect(connections[0]?.scopes).toEqual(['knowledge:read'])
    expect(fake.tokens.size).toBe(0)
  })

  test('leaves one connection when two consents for one client, organization and module go at once', async () => {
    const requests = await Promise.all([createRequest(), createRequest()])

    await Promise.all(requests.map(requestId => approve(requestId)))

    expect(fake.connections.size).toBe(1)
  })

  test('keeps a connection per module and per client', async () => {
    await approve(await createRequest())
    await approve(await createRequest({ clientId: createDocumentClient() }))

    expect(fake.connections.size).toBe(2)
  })

  test('refuses a connection past the cap, and lets a consent replacing one at the cap through', async () => {
    for (let index = 0; index < MAX_AGENT_CONNECTIONS; index++) {
      fake.connections.set(`connection-${index}`, {
        id: `connection-${index}`,
        userId: MEMBER,
        organizationId: ORGANIZATION_ID,
        clientId: index ? `https://agent${index}.example.com/metadata.json` : CLIENT_ID_URL,
        registeredClientId: null,
        clientName: 'An agent',
        module: 'knowledge',
        scopes: ['knowledge:read'],
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      })
    }

    const past = await createRequest({ clientId: createDocumentClient() })
    const { status, answer } = await approve(past)

    expect(status).toBe(409)
    expect(answer.status === 'error' && answer.code).toBe(ERROR_CODE_TOO_MANY_AGENT_CONNECTIONS)
    expect(fake.requests.get(past)?.decidedAt).toBeNull()
    expect((await approve(await createRequest(), ['knowledge:read'])).status).toBe(200)
    expect(fake.connections.size).toBe(MAX_AGENT_CONNECTIONS)
    expect(fake.connections.has('connection-0')).toBe(false)
  })

  test('holds the cap across organizations when consents in two of them go at once', async () => {
    fake.addMember(MEMBER, OTHER_ORGANIZATION_ID)

    for (let index = 0; index < MAX_AGENT_CONNECTIONS - 1; index++) {
      fake.connections.set(`connection-${index}`, {
        id: `connection-${index}`,
        userId: MEMBER,
        organizationId: ORGANIZATION_ID,
        clientId: `https://agent${index}.example.com/metadata.json`,
        registeredClientId: null,
        clientName: 'An agent',
        module: 'knowledge',
        scopes: ['knowledge:read'],
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      })
    }

    const requests = await Promise.all([createRequest(), createRequest({ clientId: createDocumentClient() })])
    const answers = await Promise.all([
      approve(requests[0]!, undefined, ORGANIZATION_ID),
      approve(requests[1]!, undefined, OTHER_ORGANIZATION_ID),
    ])

    expect(answers.map(({ status }) => status).sort()).toEqual([200, 409])
    expect(fake.connections.size).toBe(MAX_AGENT_CONNECTIONS)
  })

  test('removing the member deletes the connection with its tokens', async () => {
    await approve(await createRequest())

    const [connection] = fake.connections.values()

    fake.tokens.set('token', {
      id: 'token',
      connectionId: connection!.id,
      kind: 'REFRESH',
      hash: 'hash',
      resource: KNOWLEDGE,
      scopes: ['knowledge:read'],
      issuedFrom: 'request',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      usedAt: null,
      successorKeyVersion: null,
      createdAt: new Date().toISOString(),
    })
    fake.removeMember(MEMBER, ORGANIZATION_ID)

    expect(fake.connections.size).toBe(0)
    expect(fake.tokens.size).toBe(0)
  })
})

describe('POST /oauth/requests/:requestId/deny', () => {
  test('sends the browser back with access_denied, state and iss', async () => {
    const requestId = await createRequest()
    const { status, answer } = await deny(requestId)

    expect(status).toBe(200)
    expect(readParameters(answer.status === 'success' ? (answer.data.redirectUrl ?? '') : '')).toEqual({
      error: 'access_denied',
      error_description: expect.any(String),
      state: 'opaque state',
      iss: ISSUER,
    })
    expect(fake.requests.get(requestId)).toEqual(
      expect.objectContaining({ isApproved: false, decidedAt: expect.any(String) }),
    )
  })

  test('decides the request of a client that cannot be verified, sending the browser nowhere', async () => {
    const requestId = await createRequest({ clientId: 'https://missing.example.com/oauth/metadata.json' })

    expect(await deny(requestId)).toEqual({ status: 200, answer: { status: 'success', data: { redirectUrl: null } } })
    expect(fake.requests.get(requestId)?.isApproved).toBe(false)
  })
})
