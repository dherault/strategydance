import { afterAll, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

import createIntegrationDatabaseFake, {
  type FakeIntegration,
  IntegrationAuthentication,
  IntegrationConnectionStatus,
  IntegrationError,
  OrganizationRole,
} from './testing/createIntegrationDatabaseFake'
import createIntegrationOAuthServerFake, { FAKE_ISSUER, FAKE_MCP_URL } from './testing/createIntegrationOAuthServerFake'

// An https backend, as production's, so the callback is https and the metadata document can be offered
process.env.API_URL = 'https://api.strategydance.test'

const fake = createIntegrationDatabaseFake()
let provider = createIntegrationOAuthServerFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createGuardedFetch } = await import('~utils/createGuardedFetch')

// Every request to a server reaches the fake provider of the test running, through the real guard
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

const { INTEGRATION_OAUTH_CALLBACK_URL, INTEGRATION_OAUTH_CLIENT_ID } = await import('~constants')
const { default: startIntegrationConnection } = await import('./startIntegrationConnection')
const { default: receiveIntegrationAuthorizationCode } = await import('./receiveIntegrationAuthorizationCode')
const { default: finishIntegrationConnection } = await import('./finishIntegrationConnection')
const { default: readIntegrationAccessToken } = await import('./readIntegrationAccessToken')
const { default: disconnectIntegration } = await import('./disconnectIntegration')
const { default: cancelIntegrationConnection } = await import('./cancelIntegrationConnection')
const { default: retryIntegration } = await import('./retryIntegration')
const { default: decryptIntegrationSecret } = await import('./decryptIntegrationSecret')
const { default: encryptIntegrationSecret } = await import('./encryptIntegrationSecret')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const INTEGRATION_ID = '7c9e6679742540de944be07fc1f90ae7'
const ADA = 'ada'
const BOB = 'bob'

afterAll(() => {
  setSystemTime()
})

beforeEach(() => {
  fake.reset()
  fake.addMember(ADA, ORGANIZATION_ID, OrganizationRole.ADMINISTRATOR)
  fake.addMember(BOB, ORGANIZATION_ID)
  provider = createIntegrationOAuthServerFake()
  addServer()
  setSystemTime()
})

function addServer(fields: Partial<FakeIntegration> = {}) {
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
    ...fields,
  })
}

function caller(userId: string) {
  return { organizationId: ORGANIZATION_ID, userId, integrationId: INTEGRATION_ID }
}

const server = () => fake.integrations.get(INTEGRATION_ID)!
const connection = (userId: string) => fake.connections.get(`${INTEGRATION_ID}:${userId}`)
const tokenRequests = (grant: string) => provider.recorded.tokenRequests.filter(form => form.grant_type === grant)

async function start(userId = ADA) {
  const started = await startIntegrationConnection(caller(userId))

  if (started.outcome !== 'started') throw new Error(`Not started: ${started.outcome}`)

  return started.authorizationUrl
}

// A sign-in allowed in the member's browser, as the callback receives it
async function signIn(userId = ADA, account = `${userId}@example.com`) {
  const authorizationUrl = await start(userId)
  const search = await receiveIntegrationAuthorizationCode(provider.approve(authorizationUrl, account))

  return { authorizationUrl, search }
}

async function connect(userId = ADA, account = `${userId}@example.com`) {
  const { search } = await signIn(userId, account)
  const finished = await finishIntegrationConnection({ ...caller(userId), authorizationId: search.authorization! })

  expect(finished.outcome).toBe('connected')

  return connection(userId)!
}

function tokenOwner(userId: string, generation: string) {
  return { organizationId: ORGANIZATION_ID, integrationId: INTEGRATION_ID, generation, userId }
}

async function openAccessToken(userId: string) {
  const { generation, encryptedAccessToken } = connection(userId)!

  return decryptIntegrationSecret(encryptedAccessToken!, { purpose: 'access-token', ...tokenOwner(userId, generation) })
}

// A connection's access token set to expire in ten seconds, inside the minute a refresh comes before
function expireSoon(userId: string) {
  connection(userId)!.accessTokenExpiresAt = new Date(Date.now() + 10_000).toISOString()
}

describe('starting a Connect', () => {
  test('registers a public client once, and asks for a sign-in with PKCE, the state and the resource', async () => {
    const authorizationUrl = new URL(await start())
    const asked = authorizationUrl.searchParams

    expect(authorizationUrl.origin).toBe(FAKE_ISSUER)
    expect(provider.recorded.registrations).toHaveLength(1)
    expect(provider.recorded.registrations[0]).toMatchObject({
      client_name: 'Strategy Dance',
      redirect_uris: [INTEGRATION_OAUTH_CALLBACK_URL],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    })
    expect(asked.get('client_id')).toBe(server().oauthClientId)
    expect(asked.get('code_challenge_method')).toBe('S256')
    expect(asked.get('code_challenge')).toHaveLength(43)
    expect(asked.get('state')).toHaveLength(43)
    expect(asked.get('resource')).toBe(FAKE_MCP_URL)
    expect(asked.get('redirect_uri')).toBe(INTEGRATION_OAUTH_CALLBACK_URL)

    const [authorization] = fake.authorizations.values()

    expect(authorization.stateHash).not.toBe(asked.get('state'))
    expect(authorization.encryptedCodeVerifier).toStartWith('v1:local:')

    await start(BOB)

    expect(provider.recorded.registrations).toHaveLength(1)
  })

  test("presents Strategy Dance's client ID metadata document where the server reads them", async () => {
    provider = createIntegrationOAuthServerFake({ isClientMetadataDocumentSupported: true })

    const { search } = await signIn()

    expect(provider.recorded.registrations).toHaveLength(0)
    expect(await finishIntegrationConnection({ ...caller(ADA), authorizationId: search.authorization! })).toEqual({
      outcome: 'connected',
    })
    expect(connection(ADA)!.oauthClientId).toBe(INTEGRATION_OAUTH_CLIENT_ID)
    expect(tokenRequests('authorization_code')[0].client_id).toBe(INTEGRATION_OAUTH_CLIENT_ID)
  })

  test('has two concurrent Connects present the client recorded first', async () => {
    const [first, second] = await Promise.all([start(ADA), start(BOB)])
    const clientId = server().oauthClientId

    expect(clientId).not.toBeNull()
    expect(new URL(first).searchParams.get('client_id')).toBe(clientId)
    expect(new URL(second).searchParams.get('client_id')).toBe(clientId)
  })

  test('replaces a Connect of the member under way with the new one', async () => {
    await start()
    await start()

    expect(fake.authorizations.size).toBe(1)
  })

  test('refuses a server whose discovery names another issuer than the one recorded', async () => {
    addServer({ issuer: 'https://elsewhere.example.com' })

    expect(await startIntegrationConnection(caller(ADA))).toEqual({ outcome: 'issuerChanged' })
    expect(fake.authorizations.size).toBe(0)
  })

  test('refuses a sign-in at an address that is not https', async () => {
    provider = createIntegrationOAuthServerFake({ authorizationEndpoint: 'http://auth.example.com/authorize' })

    expect<unknown>(await startIntegrationConnection(caller(ADA))).toEqual({
      outcome: 'failed',
      kind: IntegrationError.DISCOVERY_FAILED,
    })
    expect(fake.authorizations.size).toBe(0)
  })

  test('refuses a server that takes no OAuth, and one deleted', async () => {
    addServer({ authentication: IntegrationAuthentication.NONE, issuer: null })

    expect(await startIntegrationConnection(caller(ADA))).toEqual({ outcome: 'notOAuth' })

    addServer({ deletedAt: new Date().toISOString() })

    expect(await startIntegrationConnection(caller(ADA))).toEqual({ outcome: 'gone' })
  })

  test('asks for a refresh token where the authorization server lists offline access', async () => {
    provider = createIntegrationOAuthServerFake({ scopesSupported: ['issues:read', 'offline_access'] })

    expect(new URL(await start()).searchParams.get('scope')).toBe('issues:read offline_access')
  })
})

describe('the callback', () => {
  test('keeps the code once under two concurrent callbacks, and none for a replayed one', async () => {
    const authorizationUrl = await start()
    const query = provider.approve(authorizationUrl)
    const results = await Promise.all([
      receiveIntegrationAuthorizationCode(query),
      receiveIntegrationAuthorizationCode(query),
    ])

    expect(results.map(result => result.outcome).toSorted()).toEqual(['failed', 'received'])

    const { authorization } = results.find(result => result.outcome === 'received')!

    expect(await finishIntegrationConnection({ ...caller(ADA), authorizationId: authorization! })).toEqual({
      outcome: 'connected',
    })
    expect((await receiveIntegrationAuthorizationCode(query)).outcome).toBe('failed')
    expect(await finishIntegrationConnection({ ...caller(ADA), authorizationId: authorization! })).toEqual({
      outcome: 'expired',
    })
    expect(tokenRequests('authorization_code')).toHaveLength(1)
  })

  test('answers the ids of the Connect it kept, hyphenated, so the page reads them as text', async () => {
    const { search } = await signIn()

    expect(search).toMatchObject({
      outcome: 'received',
      organization: '0f9c2b8e-4b1a-4d2c-9e7f-6a5b4c3d2e1f',
      integration: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    })
    expect(search.authorization).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
  })

  test('refuses an unknown state, a repeated parameter and a Connect expired', async () => {
    expect(await receiveIntegrationAuthorizationCode('state=unknown&code=anything')).toEqual({ outcome: 'failed' })
    expect(await receiveIntegrationAuthorizationCode('code=anything')).toEqual({ outcome: 'failed' })

    const query = provider.approve(await start())

    expect((await receiveIntegrationAuthorizationCode(`${query}&code=again`)).outcome).toBe('failed')

    setSystemTime(new Date(Date.now() + 11 * 60 * 1000))

    expect((await receiveIntegrationAuthorizationCode(query)).outcome).toBe('failed')
  })

  test('deletes the Connect a member denied', async () => {
    const search = await receiveIntegrationAuthorizationCode(provider.deny(await start()))

    expect(search.outcome).toBe('denied')
    expect(fake.authorizations.size).toBe(0)
  })

  test("refuses a sign-in naming another issuer, or none where the server sends it, as the Connect's", async () => {
    provider = createIntegrationOAuthServerFake({ isIssuerParameterSupported: true })

    const query = new URLSearchParams(provider.approve(await start()))

    query.set('iss', 'https://elsewhere.example.com')

    expect((await receiveIntegrationAuthorizationCode(query.toString())).outcome).toBe('failed')

    const missing = new URLSearchParams(provider.approve(await start()))

    missing.delete('iss')

    expect((await receiveIntegrationAuthorizationCode(missing.toString())).outcome).toBe('failed')
    expect((await signIn()).search.outcome).toBe('received')
  })

  test('finds nothing once a change of address, authentication or issuer cleared the Connect', async () => {
    const reconfigure = fake.sdk.reconfigureOrganizationIntegration as (
      dc: unknown,
      variables: object,
    ) => Promise<unknown>
    const changeIssuer = fake.sdk.changeOrganizationIntegrationIssuer as (
      dc: unknown,
      variables: object,
    ) => Promise<unknown>
    const changes = [
      () =>
        reconfigure(
          {},
          {
            ...caller(ADA),
            name: 'Issues',
            normalizedName: 'issues',
            readName: 'Issues',
            configRevision: server().configRevision,
            keyGeneration: server().keyGeneration,
            url: 'https://mcp.example.com/v2',
            catalogueSlug: null,
            authentication: IntegrationAuthentication.OAUTH,
            encryptedApiKey: null,
            apiKeyLastFour: null,
            apiKeyScheme: 'BEARER',
            apiKeyHeader: null,
            issuer: FAKE_ISSUER,
            tools: null,
            toolCount: null,
            toolDefinitionHashes: [],
          },
        ),
      () =>
        reconfigure(
          {},
          {
            ...caller(ADA),
            name: 'Issues',
            normalizedName: 'issues',
            readName: 'Issues',
            configRevision: server().configRevision,
            keyGeneration: server().keyGeneration,
            url: FAKE_MCP_URL,
            catalogueSlug: null,
            authentication: IntegrationAuthentication.NONE,
            encryptedApiKey: null,
            apiKeyLastFour: null,
            apiKeyScheme: 'BEARER',
            apiKeyHeader: null,
            issuer: null,
            tools: '[]',
            toolCount: 0,
            toolDefinitionHashes: [],
          },
        ),
      () =>
        changeIssuer(
          {},
          { ...caller(ADA), configRevision: server().configRevision, issuer: 'https://new.example.com' },
        ),
    ]

    for (const change of changes) {
      addServer()

      const waiting = provider.approve(await start(BOB))
      const { search: received } = await signIn(ADA)

      await change()

      expect(fake.authorizations.size).toBe(0)
      expect(server().oauthClientId).toBeNull()
      expect((await receiveIntegrationAuthorizationCode(waiting)).outcome).toBe('failed')
      expect(
        (await finishIntegrationConnection({ ...caller(ADA), authorizationId: received.authorization! })).outcome,
      ).toBe('expired')
    }
  })
})

describe('finishing a Connect', () => {
  test('connects the member, labelled by their ID token, and lists the tools with their first token', async () => {
    provider = createIntegrationOAuthServerFake({ isOpenIdProvider: true })

    const stored = await connect(ADA, 'ada@work.example.com')

    expect(stored).toMatchObject({
      status: IntegrationConnectionStatus.CONNECTED,
      accountLabel: 'ada@work.example.com',
      resource: FAKE_MCP_URL,
      issuer: FAKE_ISSUER,
      tokenEndpoint: `${FAKE_ISSUER}/token`,
      revocationEndpoint: `${FAKE_ISSUER}/revoke`,
      configRevision: 0,
    })
    expect(provider.isLiveAccessToken(await openAccessToken(ADA))).toBe(true)
    expect(fake.authorizations.size).toBe(0)
    expect(server().toolCount).toBe(2)
    expect(provider.recorded.listings).toEqual(['ada@work.example.com'])

    const [exchange] = tokenRequests('authorization_code')

    expect(exchange).toMatchObject({ redirect_uri: INTEGRATION_OAUTH_CALLBACK_URL, resource: FAKE_MCP_URL })
    expect(exchange.code_verifier).toHaveLength(43)
  })

  test('connects two members as two accounts, each to their own tokens, listing the tools once', async () => {
    const ada = await connect(ADA)
    const bob = await connect(BOB)

    expect(ada.generation).not.toBe(bob.generation)
    expect(await openAccessToken(ADA)).not.toBe(await openAccessToken(BOB))
    expect(provider.recorded.listings).toEqual(['ada@example.com'])
  })

  test('leaves the account unlabelled when the server sends no ID token', async () => {
    expect((await connect()).accountLabel).toBeNull()
  })

  test('finishes nothing for an account that did not start the sign-in, which the member who did still finishes', async () => {
    const { search } = await signIn(ADA)

    expect(await finishIntegrationConnection({ ...caller(BOB), authorizationId: search.authorization! })).toEqual({
      outcome: 'notYours',
    })
    expect(connection(BOB)).toBeUndefined()
    expect(tokenRequests('authorization_code')).toHaveLength(0)
    expect(await finishIntegrationConnection({ ...caller(ADA), authorizationId: search.authorization! })).toEqual({
      outcome: 'connected',
    })
  })

  test('exchanges the code once under two concurrent finishes', async () => {
    const { search } = await signIn()
    const results = await Promise.all([
      finishIntegrationConnection({ ...caller(ADA), authorizationId: search.authorization! }),
      finishIntegrationConnection({ ...caller(ADA), authorizationId: search.authorization! }),
    ])

    expect(results.map(result => result.outcome).toSorted()).toEqual(['connected', 'expired'])
    expect(tokenRequests('authorization_code')).toHaveLength(1)
  })

  test('refuses a code past its two minutes', async () => {
    const { search } = await signIn()

    setSystemTime(new Date(Date.now() + 3 * 60 * 1000))

    expect(await finishIntegrationConnection({ ...caller(ADA), authorizationId: search.authorization! })).toEqual({
      outcome: 'expired',
    })
    expect(tokenRequests('authorization_code')).toHaveLength(0)
  })

  test('refuses a token that is no bearer token, and keeps an expiry unknown when the server says none', async () => {
    provider = createIntegrationOAuthServerFake({ tokenType: 'MAC' })

    const { search } = await signIn()

    expect(await finishIntegrationConnection({ ...caller(ADA), authorizationId: search.authorization! })).toEqual({
      outcome: 'connectionRefused',
    })

    // Another authorization server, which knows nothing of the client the first registered
    provider = createIntegrationOAuthServerFake({ tokenType: 'bearer', accessTokenLifetime: null })
    addServer()

    expect((await connect()).accessTokenExpiresAt).toBeNull()
  })

  test('registers again once the authorization server no longer takes its client', async () => {
    const { search } = await signIn()

    provider.clients.clear()

    expect(await finishIntegrationConnection({ ...caller(ADA), authorizationId: search.authorization! })).toEqual({
      outcome: 'connectionRefused',
    })
    expect(server().oauthClientId).toBeNull()

    await start()

    expect(provider.recorded.registrations).toHaveLength(2)
  })

  test('authenticates a client registered with a secret, the secret encrypted for the server alone', async () => {
    provider = createIntegrationOAuthServerFake({ registeredAuthenticationMethod: 'client_secret_post' })

    await connect()

    expect(server().encryptedOAuthClientSecret).toStartWith('v1:local:')
    expect(tokenRequests('authorization_code')[0].client_secret).toStartWith('secret_')
  })

  test('never lists tools over those the server holds already', async () => {
    addServer({ tools: '[]', toolCount: 0 })

    await connect()

    expect(provider.recorded.listings).toEqual([])
    expect(server().toolCount).toBe(0)
  })

  test('revokes the tokens it got when storing the connection fails, whatever the failure', async () => {
    const { search } = await signIn()

    fake.before.set('ConnectIntegration', () => {
      throw new Error('The database is down')
    })

    await expect(
      finishIntegrationConnection({ ...caller(ADA), authorizationId: search.authorization! }),
    ).rejects.toThrow('The database is down')
    expect(connection(ADA)).toBeUndefined()
    expect(provider.recorded.revocations).toHaveLength(1)
    expect(provider.recorded.revocations[0].token_type_hint).toBe('refresh_token')
  })

  test('connects nothing for a member removed meanwhile', async () => {
    const { search } = await signIn()

    fake.removeMember(ADA, ORGANIZATION_ID)

    expect(
      (await finishIntegrationConnection({ ...caller(ADA), authorizationId: search.authorization! })).outcome,
    ).toBe('expired')
    expect(connection(ADA)).toBeUndefined()
  })

  test('connects nothing once the member canceled the Connect', async () => {
    const started = await startIntegrationConnection(caller(ADA))

    if (started.outcome !== 'started') throw new Error('Not started')

    await cancelIntegrationConnection({ ...caller(ADA), authorizationId: started.authorizationId })

    expect((await receiveIntegrationAuthorizationCode(provider.approve(started.authorizationUrl))).outcome).toBe(
      'failed',
    )
  })

  test('leaves a Connect started since alone when a Cancel of the one it replaced lands late', async () => {
    const first = await startIntegrationConnection(caller(ADA))
    const second = await startIntegrationConnection(caller(ADA))

    if (first.outcome !== 'started' || second.outcome !== 'started') throw new Error('Not started')

    await cancelIntegrationConnection({ ...caller(ADA), authorizationId: first.authorizationId })

    const { authorization } = await receiveIntegrationAuthorizationCode(provider.approve(second.authorizationUrl))

    expect(await finishIntegrationConnection({ ...caller(ADA), authorizationId: authorization! })).toEqual({
      outcome: 'connected',
    })
  })
})

describe("reading a member's access token", () => {
  test('reads a fresh token as it is, with the address of the server it was given for', async () => {
    await connect()

    expect(await readIntegrationAccessToken(caller(ADA))).toMatchObject({
      outcome: 'ready',
      url: FAKE_MCP_URL,
      accessToken: await openAccessToken(ADA),
    })
    expect(tokenRequests('refresh_token')).toHaveLength(0)
  })

  test('spends a rotating refresh token once under two concurrent refreshes, the second reading the first', async () => {
    await connect()
    expireSoon(ADA)

    const [first, second] = await Promise.all([
      readIntegrationAccessToken(caller(ADA)),
      readIntegrationAccessToken(caller(ADA)),
    ])

    expect(tokenRequests('refresh_token')).toHaveLength(1)
    expect(first.outcome).toBe('ready')
    expect(second).toEqual(first)
    expect(connection(ADA)).toMatchObject({ status: IntegrationConnectionStatus.CONNECTED, refreshLeaseId: null })
    expect(provider.isLiveAccessToken(await openAccessToken(ADA))).toBe(true)
  })

  test('waits on a lease another refresh holds, then reads its tokens', async () => {
    await connect()
    expireSoon(ADA)

    const held = connection(ADA)!
    const leaseId = '11111111111141118111111111111111'

    Object.assign(held, { refreshingUntil: new Date(Date.now() + 120_000).toISOString(), refreshLeaseId: leaseId })

    const reading = readIntegrationAccessToken(caller(ADA))
    const owner = tokenOwner(ADA, held.generation)

    await new Promise(resolve => setTimeout(resolve, 100))
    await (fake.sdk.recordIntegrationConnectionTokens as (dc: unknown, variables: object) => Promise<unknown>)(
      {},
      {
        ...caller(ADA),
        refreshLeaseId: leaseId,
        encryptedAccessToken: await encryptIntegrationSecret('access_from_the_holder', {
          purpose: 'access-token',
          ...owner,
        }),
        encryptedRefreshToken: held.encryptedRefreshToken,
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        scope: null,
      },
    )

    expect(await reading).toMatchObject({ outcome: 'ready', accessToken: 'access_from_the_holder' })
    expect(tokenRequests('refresh_token')).toHaveLength(0)
  })

  test('keeps the refresh token a server that does not rotate them answers no successor for', async () => {
    provider = createIntegrationOAuthServerFake({ isRotating: false })
    await connect()

    const refreshToken = connection(ADA)!.encryptedRefreshToken

    for (const attempt of [1, 2]) {
      expireSoon(ADA)
      expect((await readIntegrationAccessToken(caller(ADA))).outcome).toBe('ready')
      expect(tokenRequests('refresh_token')).toHaveLength(attempt)
      expect(connection(ADA)!.encryptedRefreshToken).not.toBeNull()
    }

    // Encrypted afresh or kept, it is the same token, which the server still takes
    const kept = await decryptIntegrationSecret(connection(ADA)!.encryptedRefreshToken!, {
      purpose: 'refresh-token',
      ...tokenOwner(ADA, connection(ADA)!.generation),
    })

    expect(refreshToken).not.toBeNull()
    expect(provider.isCurrentRefreshToken(kept)).toBe(true)
  })

  test('takes over a lease a crashed refresh left to lapse', async () => {
    await connect()
    expireSoon(ADA)
    Object.assign(connection(ADA)!, {
      refreshingUntil: new Date(Date.now() - 1000).toISOString(),
      refreshLeaseId: '22222222222242228222222222222222',
    })

    expect((await readIntegrationAccessToken(caller(ADA))).outcome).toBe('ready')
    expect(tokenRequests('refresh_token')).toHaveLength(1)
  })

  test('claims nothing for a reader whose refresh token another refresh has spent', async () => {
    await connect()

    const stale = connection(ADA)!.encryptedRefreshToken!

    expireSoon(ADA)
    await readIntegrationAccessToken(caller(ADA))

    const claim = fake.sdk.claimIntegrationConnectionRefresh as (
      dc: unknown,
      variables: object,
    ) => Promise<{ data: { integrationConnection_updateMany: number } }>
    const { data } = await claim(
      {},
      {
        ...caller(ADA),
        generation: connection(ADA)!.generation,
        encryptedRefreshToken: stale,
        refreshLeaseId: '33333333333343338333333333333333',
      },
    )

    expect(data.integrationConnection_updateMany).toBe(0)
  })

  test('marks the connection once the authorization server refuses its refresh for good', async () => {
    await connect()
    expireSoon(ADA)
    provider.switches.isRefreshRefused = true

    expect(await readIntegrationAccessToken(caller(ADA))).toEqual({ outcome: 'needsAuthentication' })
    expect(connection(ADA)).toMatchObject({
      status: IntegrationConnectionStatus.NEEDS_AUTHENTICATION,
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      refreshLeaseId: null,
    })
  })

  test('lets the lease go when the token endpoint is out of reach, for the next try', async () => {
    await connect()
    expireSoon(ADA)
    provider.switches.isTokenEndpointDown = true

    expect((await readIntegrationAccessToken(caller(ADA))).outcome).toBe('failed')
    expect(connection(ADA)).toMatchObject({
      status: IntegrationConnectionStatus.CONNECTED,
      refreshingUntil: null,
      refreshLeaseId: null,
    })

    provider.switches.isTokenEndpointDown = false

    expect((await readIntegrationAccessToken(caller(ADA))).outcome).toBe('ready')
  })

  test('refreshes a token the server refused, and never marks over a token refreshed meanwhile', async () => {
    await connect()

    const first = await readIntegrationAccessToken(caller(ADA))

    if (first.outcome !== 'ready') throw new Error('Not ready')

    const refreshed = await readIntegrationAccessToken(caller(ADA), { refusedAccessToken: first.encryptedAccessToken })

    expect(refreshed.outcome).toBe('ready')
    expect(tokenRequests('refresh_token')).toHaveLength(1)

    // A second caller refused with the token the first refresh replaced reads the fresh one, refreshing nothing
    expect(await readIntegrationAccessToken(caller(ADA), { refusedAccessToken: first.encryptedAccessToken })).toEqual(
      refreshed,
    )
    expect(tokenRequests('refresh_token')).toHaveLength(1)
    expect(connection(ADA)!.status).toBe(IntegrationConnectionStatus.CONNECTED)
  })

  test('marks a refused token that has no refresh token to replace it', async () => {
    await connect()

    const read = await readIntegrationAccessToken(caller(ADA))

    if (read.outcome !== 'ready') throw new Error('Not ready')

    connection(ADA)!.encryptedRefreshToken = null

    expect(await readIntegrationAccessToken(caller(ADA), { refusedAccessToken: read.encryptedAccessToken })).toEqual({
      outcome: 'needsAuthentication',
    })
    expect(connection(ADA)!.status).toBe(IntegrationConnectionStatus.NEEDS_AUTHENTICATION)
  })

  test('reads no token for a member who never connected, or once the server moved on', async () => {
    expect(await readIntegrationAccessToken(caller(ADA))).toEqual({ outcome: 'notConnected' })

    await connect()
    server().configRevision += 1

    expect(await readIntegrationAccessToken(caller(ADA))).toEqual({ outcome: 'notConnected' })
  })
})

describe("an administrator's Retry of an OAuth server", () => {
  function forgetTools() {
    Object.assign(server(), { tools: null, toolCount: null, toolDefinitionHashes: [] })
  }

  test('lists the tools again with their own token when they connected an account', async () => {
    await connect(ADA)
    forgetTools()

    expect(await retryIntegration(caller(ADA))).toEqual({ outcome: 'reached', toolCount: 2 })
    expect(server().toolCount).toBe(2)
    expect(provider.recorded.listings).toEqual(['ada@example.com', 'ada@example.com'])
  })

  test('records the issuer alone when they connected no account', async () => {
    await connect(BOB)

    expect(await retryIntegration(caller(ADA))).toEqual({ outcome: 'reached', toolCount: 2 })
    expect(provider.recorded.listings).toEqual(['bob@example.com'])
  })

  test('refreshes a token the server refused once, then answers it as theirs to connect again', async () => {
    await connect(ADA)
    provider.forgetAccessTokens()

    expect((await retryIntegration(caller(ADA))).outcome).toBe('reached')
    expect(tokenRequests('refresh_token')).toHaveLength(1)

    provider.forgetAccessTokens()
    provider.switches.isRefreshRefused = true

    expect(await retryIntegration(caller(ADA))).toEqual({ outcome: 'connectionExpired' })
    expect(connection(ADA)!.status).toBe(IntegrationConnectionStatus.NEEDS_AUTHENTICATION)
    expect(server().lastError).toBeNull()
  })
})

describe('disconnecting', () => {
  test('deletes the connection and revokes its refresh token at the authorization server', async () => {
    await connect()

    const refreshToken = await decryptIntegrationSecret(connection(ADA)!.encryptedRefreshToken!, {
      purpose: 'refresh-token',
      ...tokenOwner(ADA, connection(ADA)!.generation),
    })

    expect(await disconnectIntegration(caller(ADA))).toEqual({ outcome: 'disconnected' })
    expect(connection(ADA)).toBeUndefined()
    expect(provider.recorded.revocations).toEqual([
      { token: refreshToken, token_type_hint: 'refresh_token', client_id: server().oauthClientId! },
    ])
  })

  test('disconnects all the same when the authorization server will not revoke', async () => {
    await connect()
    provider.switches.isRevocationDown = true

    expect(await disconnectIntegration(caller(ADA))).toEqual({ outcome: 'disconnected' })
    expect(connection(ADA)).toBeUndefined()
  })

  test('leaves a reconnect made meanwhile as it is, and revokes nothing of it', async () => {
    await connect()

    // Another tab's reconnect lands between the disconnect's read and its delete
    fake.before.set('DisconnectIntegration', () => {
      connection(ADA)!.generation = '44444444444444448444444444444444'
    })

    expect(await disconnectIntegration(caller(ADA))).toEqual({ outcome: 'conflict' })
    expect(connection(ADA)).toBeDefined()
    expect(provider.recorded.revocations).toEqual([])
  })

  test("leaves another member's connection as it is", async () => {
    await connect(ADA)
    await connect(BOB)
    await disconnectIntegration(caller(BOB))

    expect(connection(ADA)).toBeDefined()
  })
})
