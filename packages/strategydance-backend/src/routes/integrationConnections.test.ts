import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express, { type NextFunction, type Request, type Response } from 'express'
import {
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_INTEGRATION_AUTHORIZATION_EXPIRED,
  ERROR_CODE_INTEGRATION_AUTHORIZATION_NOT_YOURS,
  ERROR_CODE_INTEGRATION_ISSUER_CHANGED,
  ERROR_CODE_UNAUTHORIZED_AUTHENTICATION,
} from 'strategydance-core'

import createIntegrationDatabaseFake, {
  IntegrationAuthentication,
  OrganizationRole,
} from '~domain/integrations/testing/createIntegrationDatabaseFake'
import createIntegrationOAuthServerFake, {
  FAKE_ISSUER,
  FAKE_MCP_URL,
} from '~domain/integrations/testing/createIntegrationOAuthServerFake'

// An https backend, as production's, so the callback and the metadata document are https
process.env.API_URL = 'https://api.strategydance.test'

const fake = createIntegrationDatabaseFake()
const provider = createIntegrationOAuthServerFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createGuardedFetch } = await import('~utils/createGuardedFetch')

mock.module('~domain/integrations/createIntegrationFetch', () => ({
  default: (_network: unknown, signal: AbortSignal = AbortSignal.timeout(30_000)) =>
    createGuardedFetch({
      maxBytes: 4 * 1024 * 1024,
      timeoutMs: 15_000,
      signal,
      resolve: provider.resolve,
      send: provider.send,
    }),
}))

const passThrough = () => ({ default: (_request: Request, _response: Response, next: NextFunction) => next() })

// Metering is the instance's, which these tests would exhaust between them
mock.module('~middleware/integrationRateLimit', passThrough)
mock.module('~middleware/integrationCallbackRateLimit', passThrough)
mock.module('~middleware/appCheck', passThrough)

// The caller the request names, or nobody, refused as the real middleware refuses a request with no token
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

const { INTEGRATION_CONNECTED_URL, INTEGRATION_OAUTH_CLIENT_ID } = await import('~constants')
const { default: createIntegrationsRouter } = await import('./integrations')
const { default: createIntegrationOAuthRouter } = await import('./integrationOAuth')
const { default: fetchClientMetadataDocument } = await import('~domain/oauth/fetchClientMetadataDocument')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const INTEGRATION_ID = '7c9e6679742540de944be07fc1f90ae7'
const MEMBER = 'member'
const OTHER = 'other'

const app = express()

app.use('/organizations/:organizationId/integrations', createIntegrationsRouter())
app.use('/integrations/oauth', createIntegrationOAuthRouter())

const server: Server = app.listen(0)

await new Promise(resolve => server.once('listening', resolve))

const origin = `http://localhost:${(server.address() as AddressInfo).port}`

afterAll(() => {
  server.close()
})

beforeEach(() => {
  fake.reset()
  fake.addMember(MEMBER, ORGANIZATION_ID)
  fake.addMember(OTHER, ORGANIZATION_ID, OrganizationRole.ADMINISTRATOR)
  fake.staff.add(MEMBER)
  fake.staff.add(OTHER)
  fake.integrations.set(INTEGRATION_ID, {
    id: INTEGRATION_ID,
    organizationId: ORGANIZATION_ID,
    name: 'Issues',
    normalizedName: 'issues',
    url: FAKE_MCP_URL,
    catalogueSlug: null,
    authentication: IntegrationAuthentication.OAUTH,
    isEnabled: true,
    configRevision: 0,
    encryptedApiKey: null,
    apiKeyLastFour: null,
    keyGeneration: 0,
    apiKeyScheme: 'BEARER',
    apiKeyHeader: null,
    issuer: FAKE_ISSUER,
    oauthClientId: null,
    encryptedOAuthClientSecret: null,
    oauthClientSecretExpiresAt: null,
    oauthClientAuthenticationMethod: null,
    tools: null,
    toolCount: null,
    toolDefinitionHashes: [],
    autoApprovedTools: [],
    lastError: null,
    deletedAt: null,
  })
})

async function call(method: string, path: string, viewer: string | null = MEMBER, body?: unknown) {
  const response = await fetch(`${origin}/organizations/${ORGANIZATION_ID}/integrations/${INTEGRATION_ID}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(viewer && { 'x-viewer': viewer }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return { status: response.status, body: (await response.json()) as { code?: string; data?: any } }
}

// The callback as the member's browser reaches it, not following the redirect it answers
async function callBack(query: string) {
  const response = await fetch(`${origin}/integrations/oauth/callback?${query}`, { redirect: 'manual' })
  const location = new URL(response.headers.get('location') ?? '')

  return { response, location, search: Object.fromEntries(location.searchParams) }
}

describe("a member's Connect, through the routes", () => {
  test('starts, comes back through the callback and is finished by the member', async () => {
    const started = await call('POST', '/connection')

    expect(started.status).toBe(200)
    expect(started.body.data.authorizationUrl).toStartWith(`${FAKE_ISSUER}/authorize?`)

    const { response, location, search } = await callBack(provider.approve(started.body.data.authorizationUrl))

    expect(response.status).toBe(303)
    expect(`${location.origin}${location.pathname}`).toBe(INTEGRATION_CONNECTED_URL)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(search).toMatchObject({
      outcome: 'received',
      organization: '0f9c2b8e-4b1a-4d2c-9e7f-6a5b4c3d2e1f',
      integration: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    })

    expect(await call('POST', '/connection/finish', OTHER, { authorizationId: search.authorization })).toMatchObject({
      status: 403,
      body: { code: ERROR_CODE_INTEGRATION_AUTHORIZATION_NOT_YOURS },
    })
    expect((await call('POST', '/connection/finish', MEMBER, { authorizationId: search.authorization })).status).toBe(
      200,
    )
    expect(await call('POST', '/connection/finish', MEMBER, { authorizationId: search.authorization })).toMatchObject({
      status: 410,
      body: { code: ERROR_CODE_INTEGRATION_AUTHORIZATION_EXPIRED },
    })
    expect(fake.connections.get(`${INTEGRATION_ID}:${MEMBER}`)).toBeDefined()

    // The page names the ids hyphenated, as the callback wrote them; the operations, whose variables
    // the live queries' refreshes compare as text, are handed them as Data Connect writes them
    const connected = fake.calls.find(({ name }) => name === 'ConnectIntegration')!

    expect(connected.variables).toMatchObject({ organizationId: ORGANIZATION_ID, integrationId: INTEGRATION_ID })

    expect((await call('DELETE', '/connection')).status).toBe(200)
    expect(fake.connections.size).toBe(0)
  })

  test('cancels the Connect under way it names', async () => {
    const started = await call('POST', '/connection')

    expect(started.body.data.authorizationId).toMatch(/^[0-9a-f]{32}$/)
    expect((await call('DELETE', `/connection/authorizations/${started.body.data.authorizationId}`)).status).toBe(200)
    expect(fake.authorizations.size).toBe(0)
  })

  test('refuses a server whose sign-in moved to another issuer with its own code', async () => {
    fake.integrations.get(INTEGRATION_ID)!.issuer = 'https://elsewhere.example.com'

    expect(await call('POST', '/connection')).toMatchObject({
      status: 409,
      body: { code: ERROR_CODE_INTEGRATION_ISSUER_CHANGED },
    })
  })

  test('refuses a caller who is not a member, one not staff, and one with no token', async () => {
    fake.addMember('stranger', '11111111111141118111111111111111')
    fake.staff.add('stranger')

    expect((await call('POST', '/connection', 'stranger')).body.code).toBe(ERROR_CODE_FORBIDDEN)

    fake.staff.delete(MEMBER)

    expect((await call('POST', '/connection')).body.code).toBe(ERROR_CODE_FORBIDDEN)
    expect((await call('DELETE', '/connection')).body.code).toBe(ERROR_CODE_FORBIDDEN)
    expect((await call('POST', '/connection', null)).status).toBe(401)
    expect(fake.authorizations.size).toBe(0)
  })

  test('refuses a finish naming no Connect', async () => {
    expect((await call('POST', '/connection/finish', MEMBER, { authorizationId: 'not-an-id' })).status).toBe(400)
  })
})

describe('the callback', () => {
  test('answers the page with a failure, whatever it was sent', async () => {
    for (const query of ['', 'state=unknown&code=anything', 'state=a&state=b', 'error=access_denied']) {
      const { response, search } = await callBack(query)

      expect(response.status).toBe(303)
      expect(search).toEqual({ outcome: 'failed' })
    }
  })

  test("answers the member's refusal as denied", async () => {
    const started = await call('POST', '/connection')

    expect((await callBack(provider.deny(started.body.data.authorizationUrl))).search.outcome).toBe('denied')
  })
})

describe("Strategy Dance's client ID metadata document", () => {
  test('is served at its own address, as an authorization server reading such documents takes it', async () => {
    const response = await fetch(`${origin}/integrations/oauth/client`)
    const document = await response.json()

    expect(document.client_id).toBe(INTEGRATION_OAUTH_CLIENT_ID)
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')

    // Read by Strategy Dance's own authorization server's reader, which holds a document to the specification
    const read = await fetchClientMetadataDocument(INTEGRATION_OAUTH_CLIENT_ID, async url => ({
      url,
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: Buffer.from(JSON.stringify(document)),
      isTruncated: false,
    }))

    expect(read).toEqual({
      outcome: 'valid',
      document: {
        name: 'Strategy Dance',
        redirectUris: ['https://api.strategydance.test/integrations/oauth/callback'],
      },
    })
  })
})
