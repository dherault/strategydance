import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express from 'express'

import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'
import createOAuthDatabaseFake from '~domain/oauth/testing/createOAuthDatabaseFake'

const fake = createOAuthDatabaseFake(createModuleDatabaseFakeBase())

// Nothing here may fetch an address before a member has signed in
const fetchOutbound = mock(async () => {
  throw new Error('No address is fetched before a member has signed in')
})

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('~utils/fetchOutbound', () => ({ default: fetchOutbound, OutboundRefusal: class extends Error {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createOAuthRouter } = await import('./oauth')

const ISSUER = 'http://localhost:3003'
const KNOWLEDGE = `${ISSUER}/mcp/knowledge`
const CONSENT = 'http://localhost:5173/oauth/consent?request='
const CLIENT_ID_URL = 'https://client.example.com/oauth/metadata.json'
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url')

const app = express()

app.use('/oauth', createOAuthRouter())

const server: Server = app.listen(0)

await new Promise(resolve => server.once('listening', resolve))

const origin = `http://localhost:${(server.address() as AddressInfo).port}`

afterAll(() => {
  server.close()
})

function register(body: unknown) {
  return fetch(`${origin}/oauth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function registerLoopbackClient() {
  const response = await register({ client_name: 'Cursor', redirect_uris: ['http://127.0.0.1/callback'] })

  return ((await response.json()) as { client_id: string }).client_id
}

// An authorization's query, as a client writes one, with whatever a test changes
function authorize(parameters: Record<string, string | null>, raw = '') {
  const search = new URLSearchParams()

  for (const [name, value] of Object.entries({
    response_type: 'code',
    client_id: CLIENT_ID_URL,
    redirect_uri: 'https://client.example.com/callback',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    resource: KNOWLEDGE,
    state: 'opaque state',
    ...parameters,
  })) {
    if (value !== null) search.append(name, value)
  }

  return fetch(`${origin}/oauth/authorize?${search.toString()}${raw}`, { redirect: 'manual' })
}

// The parameters an authorization's redirect carries back to the client
function readRedirect(response: Response) {
  const location = response.headers.get('location') ?? ''

  return { location, parameters: Object.fromEntries(new URL(location).searchParams) }
}

describe('POST /oauth/register', () => {
  beforeEach(() => {
    fake.reset()
  })

  test('registers a public client with loopback redirect addresses', async () => {
    const response = await register({
      client_name: 'Cursor',
      redirect_uris: ['http://127.0.0.1/callback', 'http://localhost:6274/oauth/callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      logo_uri: 'https://example.com/logo.png',
    })
    const client = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(201)
    expect(client).toEqual({
      client_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      client_id_issued_at: expect.any(Number),
      client_name: 'Cursor',
      redirect_uris: ['http://127.0.0.1/callback', 'http://localhost:6274/oauth/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    })
    expect(fake.clients.get(client.client_id as string)?.redirectUris).toEqual(client.redirect_uris as string[])
  })

  test('refuses an https redirect, a private-use one such as cursor://, and none at all', async () => {
    for (const redirectUris of [
      ['https://client.example.com/callback'],
      ['cursor://anysphere.cursor-retrieval/oauth/callback'],
      ['http://127.0.0.1/callback', 'https://client.example.com/callback'],
      [],
      undefined,
    ]) {
      const response = await register({ client_name: 'Client', redirect_uris: redirectUris })

      expect(response.status).toBe(400)
      expect(((await response.json()) as { error: string }).error).toBe('invalid_redirect_uri')
    }

    expect(fake.clients.size).toBe(0)
  })

  test('refuses any token endpoint authentication but none, and grants it does not serve', async () => {
    for (const fields of [
      { token_endpoint_auth_method: 'client_secret_basic' },
      { token_endpoint_auth_method: 'private_key_jwt' },
      { grant_types: ['client_credentials'] },
      { response_types: ['token'] },
    ]) {
      const response = await register({ redirect_uris: ['http://127.0.0.1/callback'], ...fields })

      expect(response.status).toBe(400)
      expect(((await response.json()) as { error: string }).error).toBe('invalid_client_metadata')
    }
  })

  test('answers a body that is not JSON in OAuth’s own words', async () => {
    const response = await register('{ not json')

    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: string }).error).toBe('invalid_client_metadata')
  })

  test('refuses past the day’s registrations, in all', async () => {
    for (let index = 0; index < 1000; index++) {
      fake.clients.set(`client${index}`, {
        id: `client${index}`,
        name: null,
        redirectUris: [],
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      })
    }

    const response = await register({ redirect_uris: ['http://127.0.0.1/callback'] })

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('3600')
  })
})

describe('GET /oauth/authorize', () => {
  beforeEach(() => {
    fake.reset()
    fetchOutbound.mockClear()
  })

  test('stores a client ID metadata document’s request, fetching nothing, and sends the browser to the consent page', async () => {
    const response = await authorize({ scope: 'knowledge:read' })
    const location = response.headers.get('location') ?? ''
    const [request] = [...fake.requests.values()]

    expect(response.status).toBe(302)
    expect(location).toBe(`${CONSENT}${request?.id}`)
    expect(request).toEqual(
      expect.objectContaining({
        clientId: CLIENT_ID_URL,
        registeredClientId: null,
        redirectUri: 'https://client.example.com/callback',
        codeChallenge: CHALLENGE,
        resource: KNOWLEDGE,
        scopes: ['knowledge:read'],
        state: 'opaque state',
        decidedAt: null,
      }),
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchOutbound).not.toHaveBeenCalled()
  })

  test('asks for read and write when the request names no scope', async () => {
    await authorize({})

    expect([...fake.requests.values()][0]?.scopes).toEqual(['knowledge:read', 'knowledge:write'])
  })

  test('stores a registered client’s request on any loopback port, and marks the client used', async () => {
    const clientId = await registerLoopbackClient()
    const response = await authorize({ client_id: clientId, redirect_uri: 'http://127.0.0.1:43210/callback' })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toStartWith(CONSENT)
    expect([...fake.requests.values()][0]?.registeredClientId).toBe(clientId)
    expect(fake.clients.get(clientId)?.lastUsedAt).not.toBeNull()
  })

  test('marks a registered client used before storing its request, and stores none for a client pruned meanwhile', async () => {
    const clientId = await registerLoopbackClient()

    fake.beforeOperation = async name => {
      if (name === 'RecordOAuthClientUse') fake.clients.delete(clientId)
    }

    const response = await authorize({ client_id: clientId, redirect_uri: 'http://127.0.0.1/callback' })

    expect(response.status).toBe(400)
    expect(response.headers.get('location')).toBeNull()
    expect(fake.requests.size).toBe(0)
    expect(fake.calls.indexOf('RecordOAuthClientUse')).toBeGreaterThan(-1)
    expect(fake.calls).not.toContain('CreateOAuthAuthorizationRequest')
  })

  test('renders an error before the client and its redirect are checked, and never redirects', async () => {
    const clientId = await registerLoopbackClient()

    for (const response of [
      await authorize({}, '&state=again'),
      await authorize({}, '&client_id=another'),
      await authorize({ client_id: null }),
      await authorize({ client_id: 'fedcba9876543210fedcba9876543210' }),
      await authorize({ client_id: clientId.toUpperCase() }),
      await authorize({ client_id: 'https://client.example.com' }),
      await authorize({ redirect_uri: null }),
      await authorize({ redirect_uri: 'cursor://callback' }),
      await authorize({ client_id: clientId, redirect_uri: 'http://127.0.0.1/elsewhere' }),
      await authorize({ client_id: clientId, redirect_uri: 'https://client.example.com/callback' }),
      await authorize({ client_id: clientId, redirect_uri: 'http://127.0.0.1/callback', state: 's'.repeat(2049) }),
    ]) {
      expect(response.status).toBe(400)
      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get('content-type')).toStartWith('text/html')
    }

    expect(fake.requests.size).toBe(0)
  })

  test('renders every error for a client ID metadata document’s client, whose redirect is checked only at consent', async () => {
    for (const response of [
      await authorize({ response_type: 'token' }),
      await authorize({ code_challenge_method: 'plain' }),
      await authorize({ resource: null }),
      await authorize({ scope: 'knowledge:write' }),
    ]) {
      expect(response.status).toBe(400)
      expect(response.headers.get('location')).toBeNull()
    }

    expect(fake.requests.size).toBe(0)
  })

  test('redirects an error once a registered client and its redirect are checked, with state and the exact iss', async () => {
    const clientId = await registerLoopbackClient()
    const registered = { client_id: clientId, redirect_uri: 'http://127.0.0.1:5555/callback' }

    for (const [parameters, error] of [
      [{ response_type: null }, 'invalid_request'],
      [{ response_type: 'token' }, 'unsupported_response_type'],
      [{ code_challenge_method: 'plain' }, 'invalid_request'],
      [{ code_challenge_method: null }, 'invalid_request'],
      [{ code_challenge: null }, 'invalid_request'],
      [{ resource: null }, 'invalid_target'],
      [{ resource: `${ISSUER}/mcp/budget` }, 'invalid_target'],
      [{ resource: `${KNOWLEDGE}/` }, 'invalid_target'],
      [{ scope: 'knowledge:read tasks:read' }, 'invalid_scope'],
      [{ scope: 'knowledge:write' }, 'invalid_scope'],
      [{ resource: `${ISSUER}/mcp/tasks`, scope: 'knowledge:read' }, 'invalid_scope'],
    ] as const) {
      const response = await authorize({ ...registered, ...parameters })
      const { location, parameters: answer } = readRedirect(response)

      expect(response.status).toBe(302)
      expect(location).toStartWith('http://127.0.0.1:5555/callback?')
      expect(answer).toEqual({
        error,
        error_description: expect.any(String),
        state: 'opaque state',
        iss: ISSUER,
      })
    }

    expect(fake.requests.size).toBe(0)
  })

  test('renders a repeated resource, response_type or PKCE field, whoever the client is', async () => {
    const clientId = await registerLoopbackClient()

    for (const raw of [
      `&resource=${encodeURIComponent(KNOWLEDGE)}`,
      '&response_type=code',
      `&code_challenge=${CHALLENGE}`,
      '&code_challenge_method=S256',
    ]) {
      const response = await authorize({ client_id: clientId, redirect_uri: 'http://127.0.0.1/callback' }, raw)

      expect(response.status).toBe(400)
      expect(response.headers.get('location')).toBeNull()
    }
  })

  test('answers temporarily_unavailable past the ceiling in all', async () => {
    const clientId = await registerLoopbackClient()

    for (let index = 0; index < 1000; index++) {
      fake.requests.set(`request${index}`, {
        id: `request${index}`,
        clientId,
        registeredClientId: clientId,
        redirectUri: 'http://127.0.0.1/callback',
        codeChallenge: CHALLENGE,
        resource: KNOWLEDGE,
        scopes: ['knowledge:read'],
        state: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        decidedAt: null,
        isApproved: null,
        connectionId: null,
        codeHash: null,
        codeExpiresAt: null,
        codeUsedAt: null,
        createdAt: new Date().toISOString(),
      })
    }

    const response = await authorize({ client_id: clientId, redirect_uri: 'http://127.0.0.1/callback' })

    expect(readRedirect(response).parameters.error).toBe('temporarily_unavailable')
  })
})
