import { afterAll, afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'
import { createHash } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express, { type NextFunction, type Request, type Response } from 'express'

import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'
import createOAuthDatabaseFake from '~domain/oauth/testing/createOAuthDatabaseFake'

const fake = createOAuthDatabaseFake(createModuleDatabaseFakeBase())

const CLIENT_ID = 'https://client.example.com/oauth/metadata.json'
const OTHER_CLIENT_ID = 'https://other.example.com/oauth/metadata.json'

// Every client's document says the same, so each request's redirect is declared
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

// `oauth-token-secret`, its versions and the one an instance holds as its latest, which a test
// rotates
const secrets: Record<number, string> = { 1: 'first secret', 2: 'second secret' }
let latestVersion = 1

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('~utils/fetchOutbound', () => ({ default: fetchOutbound, OutboundRefusal: class extends Error {} }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/oauth/readOAuthTokenSecret', () => ({
  default: async (version?: number) => ({
    value: secrets[version ?? latestVersion]!,
    version: version ?? latestVersion,
  }),
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

const { default: createOAuthRouter } = await import('./oauth')
const { default: createOAuthRequestsRouter } = await import('./oauthRequests')

const ISSUER = 'http://localhost:3003'
const KNOWLEDGE = `${ISSUER}/mcp/knowledge`
const TASKS = `${ISSUER}/mcp/tasks`
const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const MEMBER = 'member'
const REDIRECT_URI = 'https://client.example.com/callback'
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url')

const app = express()

app.use('/oauth/requests', createOAuthRequestsRouter())
app.use('/oauth', createOAuthRouter())

const server: Server = app.listen(0)

await new Promise(resolve => server.once('listening', resolve))

const origin = `http://localhost:${(server.address() as AddressInfo).port}`

afterAll(() => {
  server.close()
})

type Tokens = { access_token: string; refresh_token: string; token_type: string; expires_in: number; scope: string }

type TokenResponse = { status: number; body: Record<string, unknown>; headers: Headers }

function hash(token: string) {
  return createHash('sha256').update(token).digest('base64url')
}

async function post(
  path: string,
  form: string,
  contentType = 'application/x-www-form-urlencoded',
): Promise<TokenResponse> {
  const response = await fetch(`${origin}/oauth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: form,
  })
  const text = await response.text()

  return {
    status: response.status,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    headers: response.headers,
  }
}

function encode(parameters: Record<string, string | null>) {
  const search = new URLSearchParams()

  for (const [name, value] of Object.entries(parameters)) if (value !== null) search.append(name, value)

  return search.toString()
}

// A code a member allowed, as the consent page's Allow issues it
async function issueCode({
  clientId = CLIENT_ID,
  scopes = ['knowledge:read', 'knowledge:write'],
  allowed = scopes,
}: { clientId?: string; scopes?: string[]; allowed?: string[] } = {}) {
  const { data } = await (
    fake.sdk.createOAuthAuthorizationRequest as (
      ...args: unknown[]
    ) => Promise<{ data: { oAuthAuthorizationRequest_insert: { id: string } } }>
  )(
    {},
    {
      clientId,
      registeredClientId: null,
      redirectUri: REDIRECT_URI,
      codeChallenge: CHALLENGE,
      resource: KNOWLEDGE,
      scopes,
      state: 'opaque state',
    },
  )
  const requestId = data.oAuthAuthorizationRequest_insert.id
  const response = await fetch(`${origin}/oauth/requests/${requestId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: ORGANIZATION_ID, scopes: allowed }),
  })
  const { data: decision } = (await response.json()) as { data: { redirectUrl: string } }

  return { requestId, code: new URL(decision.redirectUrl).searchParams.get('code')! }
}

function exchange(code: string, parameters: Record<string, string | null> = {}) {
  return post(
    'token',
    encode({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: VERIFIER,
      resource: KNOWLEDGE,
      ...parameters,
    }),
  )
}

function refresh(refreshToken: string, parameters: Record<string, string | null> = {}) {
  return post(
    'token',
    encode({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      resource: KNOWLEDGE,
      ...parameters,
    }),
  )
}

async function connect(options?: Parameters<typeof issueCode>[0]) {
  const { code, requestId } = await issueCode(options)
  const { body } = await exchange(code, options?.clientId ? { client_id: options.clientId } : {})

  return { code, requestId, tokens: body as unknown as Tokens }
}

function expectError({ status, body }: TokenResponse, error: string) {
  expect({ status, error: body.error }).toEqual({ status: 400, error })
}

beforeEach(() => {
  fake.reset()
  fake.addMember(MEMBER, ORGANIZATION_ID)
  fake.setStaff(MEMBER)
  latestVersion = 1
})

afterEach(() => {
  setSystemTime()
})

describe('POST /oauth/token, the authorization code grant', () => {
  test('exchanges a code for an access and a refresh token, kept as hashes, never stored nor cached', async () => {
    const { code } = await issueCode()
    const response = await exchange(code)
    const tokens = response.body as unknown as Tokens

    expect(response.status).toBe(200)
    expect(tokens).toEqual({
      access_token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      scope: 'knowledge:read knowledge:write',
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(
      [...fake.tokens.values()].map(({ kind, hash: stored, resource, scopes }) => ({ kind, stored, resource, scopes })),
    ).toEqual([
      {
        kind: 'ACCESS',
        stored: hash(tokens.access_token),
        resource: KNOWLEDGE,
        scopes: ['knowledge:read', 'knowledge:write'],
      },
      {
        kind: 'REFRESH',
        stored: hash(tokens.refresh_token),
        resource: KNOWLEDGE,
        scopes: ['knowledge:read', 'knowledge:write'],
      },
    ])
  })

  test("names the scopes a member's reduced consent granted", async () => {
    const { code } = await issueCode({ allowed: ['knowledge:read'] })

    expect((await exchange(code)).body.scope).toBe('knowledge:read')
  })

  test('refuses a token request missing its resource, or naming another than its code’s', async () => {
    const { code } = await issueCode()

    expectError(await exchange(code, { resource: null }), 'invalid_request')
    expectError(await exchange(code, { resource: TASKS }), 'invalid_target')
    expectError(await exchange(code, { resource: `${KNOWLEDGE}/` }), 'invalid_target')
    expect((await exchange(code)).status).toBe(200)
  })

  test('refuses an exchange missing its client_id or redirect_uri, or naming another client or address', async () => {
    const { code } = await issueCode()

    expectError(await exchange(code, { client_id: null }), 'invalid_request')
    expectError(await exchange(code, { redirect_uri: null }), 'invalid_request')
    expectError(await exchange(code, { client_id: OTHER_CLIENT_ID }), 'invalid_grant')
    expectError(await exchange(code, { redirect_uri: `${REDIRECT_URI}/` }), 'invalid_grant')
    expect((await exchange(code)).status).toBe(200)
  })

  test('refuses a wrong verifier, or none', async () => {
    const { code } = await issueCode()

    expectError(await exchange(code, { code_verifier: `${VERIFIER.slice(0, -1)}A` }), 'invalid_grant')
    expectError(await exchange(code, { code_verifier: null }), 'invalid_request')
    expect(fake.tokens.size).toBe(0)
  })

  test('refuses a code used twice, revoking its connection with every token, after the first use’s refresh rotated too', async () => {
    const { code, tokens } = await connect()

    expect((await refresh(tokens.refresh_token)).status).toBe(200)
    expect(fake.tokens.size).toBe(4)

    expectError(await exchange(code), 'invalid_grant')
    expect(fake.connections.size).toBe(0)
    expect(fake.tokens.size).toBe(0)
  })

  test('a code presented again leaves another connection’s tokens alone', async () => {
    const { code } = await connect()

    await connect({ clientId: OTHER_CLIENT_ID })
    await exchange(code)

    expect([...fake.connections.values()].map(({ clientId }) => clientId)).toEqual([OTHER_CLIENT_ID])
    expect(fake.tokens.size).toBe(2)
  })

  test('refuses a code whose connection goes while it is exchanged, as revoked rather than a server error', async () => {
    const { code } = await issueCode()

    fake.beforeOperation = async name => {
      if (name === 'ExchangeOAuthAuthorizationCode') fake.removeMember(MEMBER, ORGANIZATION_ID)
    }

    expectError(await exchange(code), 'invalid_grant')
    expect(fake.tokens.size).toBe(0)
  })

  test('refuses a code past its minute, revoking nothing', async () => {
    const { code } = await issueCode()

    setSystemTime(Date.now() + 61 * 1000)

    expectError(await exchange(code), 'invalid_grant')
    expect(fake.connections.size).toBe(1)
  })

  test('refuses a code whose connection a later consent replaced', async () => {
    const { code } = await issueCode()

    await issueCode()

    expectError(await exchange(code), 'invalid_grant')
  })

  test('reads none of a refresh token’s parameters in a code exchange', async () => {
    const { tokens } = await connect()
    const { code } = await issueCode({ clientId: OTHER_CLIENT_ID })
    const response = await exchange(code, { client_id: OTHER_CLIENT_ID, refresh_token: tokens.refresh_token })

    expect(response.status).toBe(200)
    expect(response.body.refresh_token).not.toBe(tokens.refresh_token)
  })
})

describe('POST /oauth/token, the refresh token grant', () => {
  test('rotates a refresh token into a new pair, its two tokens differing', async () => {
    const { tokens } = await connect()
    const response = await refresh(tokens.refresh_token)
    const rotated = response.body as unknown as Tokens

    expect(response.status).toBe(200)
    expect(rotated.access_token).not.toBe(tokens.access_token)
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token)
    expect(rotated.access_token).not.toBe(rotated.refresh_token)
    expect(rotated.scope).toBe('knowledge:read knowledge:write')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
  })

  test('answers the spent token presented again within 30 seconds with the very pair its first use issued, every time', async () => {
    const { tokens } = await connect()
    const first = (await refresh(tokens.refresh_token)).body
    const again = await Promise.all([refresh(tokens.refresh_token), refresh(tokens.refresh_token)])

    setSystemTime(Date.now() + 25 * 1000)

    const later = await refresh(tokens.refresh_token)

    for (const response of [...again, later]) {
      expect(response.status).toBe(200)
      expect(response.body.access_token).toBe(first.access_token)
      expect(response.body.refresh_token).toBe(first.refresh_token)
    }

    expect(later.body.expires_in).toBeLessThanOrEqual(3575)
    expect(fake.connections.size).toBe(1)
  })

  test('answers a duplicate arriving after its successor rotated in turn with the pair the client holds now', async () => {
    const { tokens } = await connect()
    const first = (await refresh(tokens.refresh_token)).body as unknown as Tokens
    const second = (await refresh(first.refresh_token)).body as unknown as Tokens
    const delayed = (await refresh(tokens.refresh_token)).body as unknown as Tokens

    expect(delayed.access_token).toBe(second.access_token)
    expect(delayed.refresh_token).toBe(second.refresh_token)
    expect((await refresh(delayed.refresh_token)).status).toBe(200)
    expect(fake.connections.size).toBe(1)
  })

  test('answers two refreshes at once with one pair', async () => {
    const { tokens } = await connect()
    const answers = await Promise.all([refresh(tokens.refresh_token), refresh(tokens.refresh_token)])

    expect(answers.map(({ status }) => status)).toEqual([200, 200])
    expect(answers[0]?.body.refresh_token).toBe(answers[1]?.body.refresh_token)
  })

  test('answers a duplicate across a rotation of the secret with the first use’s pair', async () => {
    const { tokens } = await connect()
    const first = (await refresh(tokens.refresh_token)).body

    latestVersion = 2

    const duplicate = await refresh(tokens.refresh_token)

    expect(duplicate.body.refresh_token).toBe(first.refresh_token)
    expect(
      [...fake.tokens.values()].find(({ hash: stored }) => stored === hash(tokens.refresh_token))?.successorKeyVersion,
    ).toBe(1)
  })

  test('revokes the connection when the spent token comes back after 30 seconds', async () => {
    const { tokens } = await connect()
    const rotated = (await refresh(tokens.refresh_token)).body as unknown as Tokens

    setSystemTime(Date.now() + 31 * 1000)

    expectError(await refresh(tokens.refresh_token), 'invalid_grant')
    expect(fake.connections.size).toBe(0)
    expectError(await refresh(rotated.refresh_token), 'invalid_grant')
  })

  test('hands out no successor revoked since', async () => {
    const { tokens } = await connect()
    const rotated = (await refresh(tokens.refresh_token)).body as unknown as Tokens

    expect((await post('revoke', encode({ token: rotated.access_token, client_id: CLIENT_ID }))).status).toBe(200)
    expectError(await refresh(tokens.refresh_token), 'invalid_grant')
  })

  test('refuses another client, another resource, or none', async () => {
    const { tokens } = await connect()

    expectError(await refresh(tokens.refresh_token, { client_id: OTHER_CLIENT_ID }), 'invalid_grant')
    expectError(await refresh(tokens.refresh_token, { resource: TASKS }), 'invalid_target')
    expectError(await refresh(tokens.refresh_token, { resource: null }), 'invalid_request')
    expect((await refresh(tokens.refresh_token)).status).toBe(200)
  })

  test('narrows the access token to the scopes a refresh names, the refresh token keeping its own', async () => {
    const { tokens } = await connect()
    const narrowed = await refresh(tokens.refresh_token, { scope: 'knowledge:read' })
    const narrowedTokens = narrowed.body as unknown as Tokens
    const scopesOf = (token: string) =>
      [...fake.tokens.values()].find(({ hash: stored }) => stored === hash(token))?.scopes

    expect(narrowedTokens.scope).toBe('knowledge:read')
    expect(scopesOf(narrowedTokens.access_token)).toEqual(['knowledge:read'])
    expect(scopesOf(narrowedTokens.refresh_token)).toEqual(['knowledge:read', 'knowledge:write'])
    expect((await refresh(narrowedTokens.refresh_token)).body.scope).toBe('knowledge:read knowledge:write')
  })

  test('refuses a refresh naming a scope its token was not granted, or write without read', async () => {
    const { tokens } = await connect({ allowed: ['knowledge:read'] })

    expectError(await refresh(tokens.refresh_token, { scope: 'knowledge:read knowledge:write' }), 'invalid_scope')
    expectError(await refresh(tokens.refresh_token, { scope: 'knowledge:read tasks:read' }), 'invalid_scope')
    expectError(await refresh(tokens.refresh_token, { scope: 'knowledge:write' }), 'invalid_scope')
    expect((await refresh(tokens.refresh_token, { scope: 'knowledge:read' })).body.scope).toBe('knowledge:read')
  })

  test('refuses a refresh whose connection goes while it rotates, as revoked rather than a server error', async () => {
    const { tokens } = await connect()

    fake.beforeOperation = async name => {
      if (name === 'RotateAgentConnectionRefreshToken') fake.removeMember(MEMBER, ORGANIZATION_ID)
    }

    expectError(await refresh(tokens.refresh_token), 'invalid_grant')
  })

  test('refuses an access token presented as a refresh token', async () => {
    const { tokens } = await connect()

    expectError(await refresh(tokens.access_token), 'invalid_grant')
  })

  test('refuses a refresh token past its 30 days', async () => {
    const { tokens } = await connect()

    setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000)

    expectError(await refresh(tokens.refresh_token), 'invalid_grant')
  })

  test('refuses a refresh token once the member is removed', async () => {
    const { tokens } = await connect()

    fake.removeMember(MEMBER, ORGANIZATION_ID)

    expectError(await refresh(tokens.refresh_token), 'invalid_grant')
  })
})

describe('POST /oauth/token, whatever the grant', () => {
  test('refuses grant_type missing, repeated or unknown', async () => {
    expectError(await post('token', encode({ code: 'x' })), 'invalid_request')
    expectError(await post('token', 'grant_type=authorization_code&grant_type=refresh_token'), 'invalid_request')
    expectError(await post('token', encode({ grant_type: 'client_credentials' })), 'unsupported_grant_type')
    expectError(await post('token', encode({ grant_type: 'password' })), 'unsupported_grant_type')
  })

  test('refuses any parameter repeated, the verifier included', async () => {
    const { code } = await issueCode()

    for (const name of ['code', 'code_verifier', 'client_id', 'resource', 'redirect_uri']) {
      const form = `${encode({ grant_type: 'authorization_code', code, client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, code_verifier: VERIFIER, resource: KNOWLEDGE })}&${name}=again`

      expectError(await post('token', form), 'invalid_request')
    }

    expect((await exchange(code)).status).toBe(200)
  })

  test('refuses a body that is not a form, never caching the refusal', async () => {
    const response = await post('token', JSON.stringify({ grant_type: 'authorization_code' }), 'application/json')

    expectError(response, 'invalid_request')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
  })
})

describe('POST /oauth/revoke', () => {
  test('revoking a refresh token ends the connection with every token', async () => {
    const { tokens } = await connect()
    const response = await post('revoke', encode({ token: tokens.refresh_token, client_id: CLIENT_ID }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fake.connections.size).toBe(0)
    expectError(await refresh(tokens.refresh_token), 'invalid_grant')
  })

  test('revoking an access token revokes it alone', async () => {
    const { tokens } = await connect()

    expect((await post('revoke', encode({ token: tokens.access_token, client_id: CLIENT_ID }))).status).toBe(200)
    expect([...fake.tokens.values()].map(({ kind }) => kind)).toEqual(['REFRESH'])
    expect((await refresh(tokens.refresh_token)).status).toBe(200)
  })

  test('refuses a token issued to another client, leaving the connection as it was', async () => {
    const { tokens } = await connect()
    const response = await post('revoke', encode({ token: tokens.refresh_token, client_id: OTHER_CLIENT_ID }))

    expectError(response, 'unauthorized_client')
    expect(fake.connections.size).toBe(1)
    expect(fake.tokens.size).toBe(2)
  })

  test('answers a token it does not know as revoked, and refuses a revocation naming no client', async () => {
    expect((await post('revoke', encode({ token: 'unknown', client_id: CLIENT_ID }))).status).toBe(200)
    expectError(await post('revoke', encode({ token: 'unknown' })), 'invalid_request')
    expectError(await post('revoke', 'token=a&token=b&client_id=c'), 'invalid_request')
  })
})
