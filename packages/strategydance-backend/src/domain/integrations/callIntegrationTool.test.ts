import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ResolvedAddress } from '~utils/requestOutbound'

import createIntegrationDatabaseFake, {
  type FakeIntegration,
  IntegrationAuthentication,
  IntegrationConnectionStatus,
  OrganizationRole,
} from './testing/createIntegrationDatabaseFake'
import createIntegrationOAuthServerFake, { FAKE_ISSUER, FAKE_MCP_URL } from './testing/createIntegrationOAuthServerFake'
import createIntegrationServerFake from './testing/createIntegrationServerFake'

process.env.API_URL = 'https://api.strategydance.test'

const fake = createIntegrationDatabaseFake()
let provider = createIntegrationOAuthServerFake()
// The network the guarded fetch reaches: the OAuth provider, or a key-based server a test makes
let network: { resolve: () => Promise<ResolvedAddress[]>; send: typeof provider.send } = provider

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
      resolve: () => network.resolve(),
      send: (...args) => network.send(...args),
    }),
}))

const { default: startIntegrationConnection } = await import('./startIntegrationConnection')
const { default: receiveIntegrationAuthorizationCode } = await import('./receiveIntegrationAuthorizationCode')
const { default: finishIntegrationConnection } = await import('./finishIntegrationConnection')
const { default: encryptIntegrationKey } = await import('./encryptIntegrationKey')
const { default: IntegrationCallChanged } = await import('./IntegrationCallChanged')
const { default: callIntegrationTool } = await import('./callIntegrationTool')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const INTEGRATION_ID = '7c9e6679742540de944be07fc1f90ae7'
const ADA = 'ada'
const BOB = 'bob'

beforeEach(() => {
  fake.reset()
  fake.addMember(ADA, ORGANIZATION_ID, OrganizationRole.ADMINISTRATOR)
  fake.addMember(BOB, ORGANIZATION_ID)
  provider = createIntegrationOAuthServerFake()
  network = provider
  addServer()
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

const server = () => fake.integrations.get(INTEGRATION_ID)!
const connection = (userId: string) => fake.connections.get(`${INTEGRATION_ID}:${userId}`)

// The member's account connected, which lists the server's tools on the first connection
async function connect(userId = ADA, account = `${userId}@example.com`) {
  const member = { organizationId: ORGANIZATION_ID, userId, integrationId: INTEGRATION_ID }
  const started = await startIntegrationConnection(member)

  if (started.outcome !== 'started') throw new Error(`Not started: ${started.outcome}`)

  const search = await receiveIntegrationAuthorizationCode(provider.approve(started.authorizationUrl, account))
  const finished = await finishIntegrationConnection({ ...member, authorizationId: search.authorization! })

  expect(finished.outcome).toBe('connected')
}

function toolHash(name = 'list_issues') {
  const tools: { name: string; definitionHash: string }[] = JSON.parse(server().tools ?? '[]')

  return tools.find(tool => tool.name === name)?.definitionHash ?? ''
}

// A call as a member, bound to the server, the tool and the credential as they are now, unless the
// test says otherwise
function call(
  userId = ADA,
  overrides: Partial<Parameters<typeof callIntegrationTool>[1]> = {},
  signal = AbortSignal.timeout(30_000),
) {
  return callIntegrationTool(
    {
      organizationId: ORGANIZATION_ID,
      userId,
      membershipCreatedAt: fake.membershipCreatedAt(userId, ORGANIZATION_ID)!,
    },
    {
      integrationId: INTEGRATION_ID,
      toolName: 'list_issues',
      arguments: { query: 'open' },
      binding: {
        configRevision: server().configRevision,
        toolHash: toolHash(),
        credentialGeneration:
          server().authentication === IntegrationAuthentication.OAUTH
            ? (connection(userId)?.generation ?? null)
            : server().authentication === IntegrationAuthentication.API_KEY
              ? String(server().keyGeneration)
              : null,
      },
      isAutoApproved: false,
      ...overrides,
    },
    { signal },
  )
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error
  }

  throw new Error('The call went through')
}

// The tools a key server lists, stored as listing them would
function storeKeyServerTools(keyServer: ReturnType<typeof createIntegrationServerFake>) {
  Object.assign(server(), {
    tools: keyServer.storedTools(),
    toolCount: 2,
    toolDefinitionHashes: [keyServer.hashOf('list_issues'), keyServer.hashOf('create_issue')],
  })
}

describe('callIntegrationTool with a member’s own account', () => {
  test('calls the tool as the member and answers its content', async () => {
    await connect(ADA, 'ada@work.example.com')

    expect(await call()).toEqual({ content: [{ type: 'text', text: 'list_issues: open' }] })
    expect(provider.recorded.calls).toEqual([
      { account: 'ada@work.example.com', name: 'list_issues', arguments: { query: 'open' } },
    ])
  })

  test('sends the arguments exactly as stored, U+0000 in a nested key and a value included', async () => {
    await connect()

    const args = { query: 'a\u0000b', filters: { 'acct\u0000admin': ['x\u0000'] } }

    await call(ADA, { arguments: args })

    expect(provider.recorded.calls.at(-1)?.arguments).toEqual(args)
  })

  test('refuses a call whose server changed since it was proposed', async () => {
    await connect()

    const changed = await refusal(
      call(ADA, {
        binding: { configRevision: 7, toolHash: toolHash(), credentialGeneration: connection(ADA)!.generation },
      }),
    )

    expect(changed).toBeInstanceOf(IntegrationCallChanged)
    expect(provider.recorded.calls).toEqual([])
  })

  test('refuses a call whose tool’s definition changed', async () => {
    await connect()

    const changed = await refusal(
      call(ADA, {
        binding: { configRevision: 0, toolHash: 'a'.repeat(64), credentialGeneration: connection(ADA)!.generation },
      }),
    )

    expect(changed).toBeInstanceOf(IntegrationCallChanged)
  })

  test('refuses a call bound to an account the member has since replaced', async () => {
    await connect(ADA, 'ada@work.example.com')

    const before = connection(ADA)!.generation

    await connect(ADA, 'ada@home.example.com')

    const changed = await refusal(
      call(ADA, { binding: { configRevision: 0, toolHash: toolHash(), credentialGeneration: before } }),
    )

    expect(changed).toBeInstanceOf(IntegrationCallChanged)
    expect(provider.recorded.calls).toEqual([])
  })

  test('keeps a call bound across a refresh of the token, which keeps the generation', async () => {
    await connect()

    const binding = { configRevision: 0, toolHash: toolHash(), credentialGeneration: connection(ADA)!.generation }

    connection(ADA)!.accessTokenExpiresAt = new Date(Date.now() + 10_000).toISOString()

    expect(await call(ADA, { binding })).toMatchObject({ content: [{ text: 'list_issues: open' }] })
    expect(connection(ADA)!.generation).toBe(binding.credentialGeneration)
  })

  test('refreshes a token the server refused with a 401, and calls once more', async () => {
    await connect()
    provider.forgetAccessTokens()

    expect(await call()).toMatchObject({ content: [{ text: 'list_issues: open' }] })
    expect(provider.recorded.calls).toHaveLength(1)
    expect(connection(ADA)!.status).toBe(IntegrationConnectionStatus.CONNECTED)
  })

  test('marks the connection as needing the member when even a refreshed token is refused', async () => {
    await connect()
    provider.switches.isEveryTokenRefused = true

    const refused = await refusal(call())

    expect((refused as Error).message).toContain('needs them to connect again')
    expect(connection(ADA)!.status).toBe(IntegrationConnectionStatus.NEEDS_AUTHENTICATION)
  })

  test('marks nothing on a 403, the call refused for this account alone', async () => {
    await connect()
    provider.switches.isEveryCallForbidden = true

    const refused = await refusal(call())

    expect((refused as Error).message).toBe("Issues refused this call for the member's account.")
    expect(connection(ADA)!.status).toBe(IntegrationConnectionStatus.CONNECTED)
  })

  test('throws the tool’s own error when it ran and failed', async () => {
    await connect()
    provider.switches.isToolFailing = true

    const refused = await refusal(call())

    expect((refused as Error).message).toBe('Issues answered with an error: The tracker is down')
  })

  test('refuses a member who never connected, and a server turned off, saying what fixes it', async () => {
    await connect(ADA)

    expect(((await refusal(call(BOB))) as Error).message).toContain('has not connected their account to Issues')

    server().isEnabled = false

    expect(((await refusal(call(ADA))) as Error).message).toContain('Issues is turned off')
  })

  test('refuses an auto-approved call once an administrator took its approval back', async () => {
    await connect()
    server().autoApprovedTools = [toolHash()]

    expect(await call(ADA, { isAutoApproved: true })).toMatchObject({ content: [{ text: 'list_issues: open' }] })

    server().autoApprovedTools = []

    const withdrawn = await refusal(call(ADA, { isAutoApproved: true }))

    expect(withdrawn).toBeInstanceOf(IntegrationCallChanged)
    expect((withdrawn as Error).message).toContain('no longer lets this tool of Issues run without')
  })

  test('stops waiting for a refresh at its budget, the refresh going on to keep its tokens', async () => {
    await connect()

    const before = connection(ADA)!.encryptedAccessToken

    connection(ADA)!.accessTokenExpiresAt = new Date(Date.now() + 10_000).toISOString()
    provider.switches.tokenEndpointDelayMs = 300

    const refused = await refusal(call(ADA, {}, AbortSignal.timeout(50)))

    expect((refused as Error).message).toContain('could not be refreshed in time')
    expect(provider.recorded.calls).toEqual([])

    await new Promise(resolve => setTimeout(resolve, 500))

    expect(connection(ADA)!.encryptedAccessToken).not.toBe(before)
    expect(connection(ADA)!.status).toBe(IntegrationConnectionStatus.CONNECTED)
  })

  test('calls nothing when the server was turned off while its token refreshed, the tokens kept', async () => {
    await connect()

    const before = connection(ADA)!.encryptedAccessToken

    connection(ADA)!.accessTokenExpiresAt = new Date(Date.now() + 10_000).toISOString()
    fake.after.set('RecordIntegrationConnectionTokens', () => {
      server().isEnabled = false
    })

    const refused = await refusal(call())

    expect((refused as Error).message).toContain('Issues is turned off')
    expect(provider.recorded.calls).toEqual([])
    expect(connection(ADA)!.encryptedAccessToken).not.toBe(before)
  })

  test('says a call cut short may still have run', async () => {
    const server = createIntegrationServerFake()

    network = server
    addServer({ authentication: IntegrationAuthentication.NONE, issuer: null })
    storeKeyServerTools(server)

    const refused = await refusal(call(ADA, {}, AbortSignal.abort()))

    expect((refused as Error).message).toContain('may still have run')
  })

  test('refuses a server deleted meanwhile, and a member removed since the run started', async () => {
    await connect()

    const membershipCreatedAt = fake.membershipCreatedAt(ADA, ORGANIZATION_ID)!

    server().deletedAt = new Date().toISOString()

    expect(((await refusal(call())) as Error).message).toContain('This integration no longer exists')

    server().deletedAt = null
    fake.removeMember(ADA, ORGANIZATION_ID)
    fake.addMember(ADA, ORGANIZATION_ID)

    const removed = await refusal(
      callIntegrationTool(
        { organizationId: ORGANIZATION_ID, userId: ADA, membershipCreatedAt },
        {
          integrationId: INTEGRATION_ID,
          toolName: 'list_issues',
          arguments: { query: 'open' },
          binding: { configRevision: 0, toolHash: toolHash(), credentialGeneration: null },
          isAutoApproved: false,
        },
        { signal: AbortSignal.timeout(30_000) },
      ),
    )

    expect((removed as Error).message).toContain('This integration no longer exists')
    expect(provider.recorded.calls).toEqual([])
  })
})

describe('callIntegrationTool with the organization’s key', () => {
  test('sends the key as a bearer token', async () => {
    const keyServer = createIntegrationServerFake({
      isAuthorized: headers => headers.get('authorization') === 'Bearer secret-key',
    })

    network = keyServer
    addServer({
      authentication: IntegrationAuthentication.API_KEY,
      issuer: null,
      apiKeyLastFour: '-key',
      encryptedApiKey: await encryptIntegrationKey('secret-key', {
        organizationId: ORGANIZATION_ID,
        integrationId: INTEGRATION_ID,
      }),
      keyGeneration: 2,
    })
    storeKeyServerTools(keyServer)

    expect(await call(BOB)).toEqual({ content: [{ type: 'text', text: 'list_issues: open' }] })
    expect(keyServer.calls).toEqual([{ name: 'list_issues', arguments: { query: 'open' } }])
  })

  test('sends the key alone in the header named', async () => {
    const keyServer = createIntegrationServerFake({
      isAuthorized: headers => headers.get('x-api-key') === 'secret-key',
    })

    network = keyServer
    addServer({
      authentication: IntegrationAuthentication.API_KEY,
      issuer: null,
      apiKeyScheme: 'HEADER',
      apiKeyHeader: 'X-API-Key',
      apiKeyLastFour: '-key',
      encryptedApiKey: await encryptIntegrationKey('secret-key', {
        organizationId: ORGANIZATION_ID,
        integrationId: INTEGRATION_ID,
      }),
    })
    storeKeyServerTools(keyServer)

    expect(await call()).toEqual({ content: [{ type: 'text', text: 'list_issues: open' }] })
  })

  test('says the key was refused, and refuses a call bound to a key since replaced', async () => {
    const keyServer = createIntegrationServerFake({ isAuthorized: () => false })

    network = keyServer
    addServer({
      authentication: IntegrationAuthentication.API_KEY,
      issuer: null,
      apiKeyLastFour: '-key',
      encryptedApiKey: await encryptIntegrationKey('stale-key', {
        organizationId: ORGANIZATION_ID,
        integrationId: INTEGRATION_ID,
      }),
      keyGeneration: 3,
    })
    storeKeyServerTools(keyServer)

    expect(((await refusal(call())) as Error).message).toBe(
      "Issues refused the organization's key. Tell the member an administrator can replace it.",
    )

    const changed = await refusal(
      call(ADA, { binding: { configRevision: 0, toolHash: toolHash(), credentialGeneration: '2' } }),
    )

    expect(changed).toBeInstanceOf(IntegrationCallChanged)
  })
})
