import { beforeEach, describe, expect, mock, setSystemTime, afterEach, test } from 'bun:test'
import { createHash } from 'node:crypto'

import { OAuthError } from '@modelcontextprotocol/server'

import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'
import createOAuthDatabaseFake from '~domain/oauth/testing/createOAuthDatabaseFake'

const fake = createOAuthDatabaseFake(createModuleDatabaseFakeBase())
const logged = mock((_message: string, _error?: unknown) => {})

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: logged } }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createAgentConnectionTokenVerifier } = await import('./createAgentConnectionTokenVerifier')
const { default: readModuleAccess } = await import('~modules/readModuleAccess')

const DOCUMENTS = 'http://localhost:3003/mcp/documents'
const TASKS = 'http://localhost:3003/mcp/tasks'
const ONE_ADDRESS = 'http://localhost:3003/mcp'
const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const OTHER_ORGANIZATION_ID = '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b'
const THIRD_ORGANIZATION_ID = '2b3c4d5e6f7a48190b1c2d3e4f5a6b7c'
const MEMBER = 'member'
const CONNECTION_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const verifier = createAgentConnectionTokenVerifier(new URL(DOCUMENTS))

function hash(token: string) {
  return createHash('sha256').update(token).digest('base64url')
}

// A connection of the member's, holding a token of each kind, as a code's exchange stores them
function connect({
  scopes = ['documents:read'],
  resource = DOCUMENTS,
  accessScopes,
  organizationIds = [ORGANIZATION_ID],
}: { scopes?: string[]; resource?: string; accessScopes?: string[]; organizationIds?: string[] } = {}) {
  fake.connections.set(CONNECTION_ID, {
    id: CONNECTION_ID,
    userId: MEMBER,
    organizationIds,
    grantedAt: fake.stamp(),
    clientId: 'https://client.example.com/oauth/metadata.json',
    registeredClientId: null,
    clientName: 'Example Agent',
    module: 'documents',
    scopes,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  })

  for (const kind of ['ACCESS', 'REFRESH'] as const) {
    fake.tokens.set(kind, {
      id: kind,
      connectionId: CONNECTION_ID,
      kind,
      hash: hash(kind.toLowerCase()),
      resource,
      scopes: accessScopes ?? scopes,
      issuedFrom: 'request',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      usedAt: null,
      successorKeyVersion: null,
      createdAt: new Date().toISOString(),
    })
  }
}

async function refusal(token: string, from = verifier) {
  try {
    await from.verifyAccessToken(token)

    return null
  } catch (error) {
    return error instanceof OAuthError ? error.code : String(error)
  }
}

let membershipCreatedAt = ''

beforeEach(() => {
  fake.reset()
  logged.mockClear()
  membershipCreatedAt = fake.addMember(MEMBER, ORGANIZATION_ID)
})

afterEach(() => {
  setSystemTime()
})

describe('createAgentConnectionTokenVerifier', () => {
  test("accepts a valid access token, carrying the row's expiry and resource and the member's caller", async () => {
    connect({ scopes: ['documents:read', 'documents:write'] })

    const authInfo = await verifier.verifyAccessToken('access')

    expect(authInfo).toMatchObject({
      token: 'access',
      clientId: 'https://client.example.com/oauth/metadata.json',
      scopes: ['documents:read', 'documents:write'],
      expiresAt: Math.floor(Date.parse(fake.tokens.get('ACCESS')!.expiresAt) / 1000),
      resource: new URL(DOCUMENTS),
    })
    expect(readModuleAccess(authInfo)).toEqual({
      kind: 'external',
      userId: MEMBER,
      scopes: ['documents:read', 'documents:write'],
      connectionScopes: ['documents:read', 'documents:write'],
      idempotencyScope: `connection:${CONNECTION_ID}`,
      organizations: [
        {
          organizationId: ORGANIZATION_ID,
          membershipCreatedAt,
          segment: ORGANIZATION_ID,
          name: 'Checked organization',
        },
      ],
    })
  })

  test('names the organization by its slug, and by its name, once it has one', async () => {
    connect()
    Object.assign(fake.organizations.get(ORGANIZATION_ID)!, { slug: 'acme-ab12', name: 'Acme' })

    expect(readModuleAccess(await verifier.verifyAccessToken('access'))).toMatchObject({
      organizations: [{ organizationId: ORGANIZATION_ID, segment: 'acme-ab12', name: 'Acme' }],
    })
  })

  test("carries the scopes a refresh narrowed the token to, within its connection's", async () => {
    connect({ scopes: ['documents:read', 'documents:write'], accessScopes: ['documents:read'] })

    const authInfo = await verifier.verifyAccessToken('access')

    expect(authInfo.scopes).toEqual(['documents:read'])
    expect(readModuleAccess(authInfo).scopes).toEqual(['documents:read'])
  })

  test('refuses a token for another module', async () => {
    connect()

    expect(await refusal('access', createAgentConnectionTokenVerifier(new URL(TASKS)))).toBe('invalid_token')
  })

  test("refuses a module's own address's token at the one address, and the one address's at a module's", async () => {
    const oneAddress = createAgentConnectionTokenVerifier(new URL(ONE_ADDRESS))

    connect({ scopes: ['tasks:read'], resource: TASKS })

    expect(await refusal('access', oneAddress)).toBe('invalid_token')

    connect({ scopes: ['documents:read', 'tasks:read'], resource: ONE_ADDRESS })

    expect(await refusal('access', createAgentConnectionTokenVerifier(new URL(TASKS)))).toBe('invalid_token')
    expect(await refusal('access')).toBe('invalid_token')
    expect((await oneAddress.verifyAccessToken('access')).scopes).toEqual(['documents:read', 'tasks:read'])
  })

  test("keys the one address's writes on the member, the client and the address, so the scope outlives a consent", async () => {
    const oneAddress = createAgentConnectionTokenVerifier(new URL(ONE_ADDRESS))
    const clientId = 'https://client.example.com/oauth/metadata.json'
    const scopeOf = async () => readModuleAccess(await oneAddress.verifyAccessToken('access')).idempotencyScope

    connect({ scopes: ['documents:read', 'tasks:read'], resource: ONE_ADDRESS })

    const scope = await scopeOf()

    expect(scope).toBe(`external:${hash(JSON.stringify([MEMBER, clientId, 'strategydance']))}`)

    // A consent again replaces the connection by another, of another id, its tokens with it
    const connection = fake.connections.get(CONNECTION_ID)!
    const replacement = 'cccccccccccccccccccccccccccccccc'

    fake.connections.delete(CONNECTION_ID)
    fake.connections.set(replacement, { ...connection, id: replacement })
    fake.tokens.get('ACCESS')!.connectionId = replacement

    expect(await scopeOf()).toBe(scope)

    fake.connections.get(replacement)!.clientId = 'https://other.example.com/oauth/metadata.json'

    expect(await scopeOf()).not.toBe(scope)

    fake.connections.get(replacement)!.clientId = clientId
    fake.addMember('other member', ORGANIZATION_ID)
    Object.assign(fake.connections.get(replacement)!, { userId: 'other member', grantedAt: fake.stamp() })

    expect(await scopeOf()).not.toBe(scope)
  })

  test('carries no scope of a module its address does not serve, so no challenge ever names one', async () => {
    connect({ scopes: ['tasks:read', 'budget:read', 'budget:write'], resource: TASKS })

    expect(
      readModuleAccess(await createAgentConnectionTokenVerifier(new URL(TASKS)).verifyAccessToken('access')),
    ).toMatchObject({ scopes: ['tasks:read'], connectionScopes: ['tasks:read'] })
  })

  test("keeps a module's own address's writes under the connection's id", async () => {
    connect({ scopes: ['tasks:read'], resource: TASKS })

    expect(
      readModuleAccess(await createAgentConnectionTokenVerifier(new URL(TASKS)).verifyAccessToken('access')),
    ).toMatchObject({ idempotencyScope: `connection:${CONNECTION_ID}` })
  })

  test('refuses a refresh token presented as an access token', async () => {
    connect()

    expect(await refusal('refresh')).toBe('invalid_token')
  })

  test('refuses an unknown, an expired and a revoked token', async () => {
    connect()

    expect(await refusal('unknown')).toBe('invalid_token')

    setSystemTime(Date.now() + 61 * 60 * 1000)

    expect(await refusal('access')).toBe('invalid_token')

    setSystemTime()
    fake.tokens.delete('ACCESS')

    expect(await refusal('access')).toBe('invalid_token')
  })

  test("refuses a removed member's token", async () => {
    connect()
    fake.removeMember(MEMBER, ORGANIZATION_ID)

    expect(await refusal('access')).toBe('invalid_token')
  })

  test('acts in every organization the connection reaches, in the order the member joined them', async () => {
    const joined = fake.addMember(MEMBER, OTHER_ORGANIZATION_ID, { slug: 'beta-k3j4', name: 'Beta' })

    connect({ organizationIds: [OTHER_ORGANIZATION_ID, ORGANIZATION_ID] })

    expect(readModuleAccess(await verifier.verifyAccessToken('access'))).toMatchObject({
      organizations: [
        { organizationId: ORGANIZATION_ID, membershipCreatedAt, segment: ORGANIZATION_ID },
        { organizationId: OTHER_ORGANIZATION_ID, membershipCreatedAt: joined, segment: 'beta-k3j4', name: 'Beta' },
      ],
    })
  })

  test('leaves out an organization it does not list, one the member left, and one they were invited back to since', async () => {
    fake.addMember(MEMBER, OTHER_ORGANIZATION_ID)
    fake.addMember(MEMBER, THIRD_ORGANIZATION_ID)
    connect({ organizationIds: [ORGANIZATION_ID, OTHER_ORGANIZATION_ID] })

    const reached = async () =>
      (
        readModuleAccess(await verifier.verifyAccessToken('access')) as { organizations: { organizationId: string }[] }
      ).organizations.map(({ organizationId }) => organizationId)

    expect(await reached()).toEqual([ORGANIZATION_ID, OTHER_ORGANIZATION_ID])

    fake.removeMember(MEMBER, OTHER_ORGANIZATION_ID)

    expect(await reached()).toEqual([ORGANIZATION_ID])

    fake.addMember(MEMBER, OTHER_ORGANIZATION_ID)

    expect(await reached()).toEqual([ORGANIZATION_ID])
  })

  test('refuses a token whose connection reaches none of the member’s organizations any more, marking nothing used', async () => {
    connect()
    fake.removeMember(MEMBER, ORGANIZATION_ID)
    fake.addMember(MEMBER, ORGANIZATION_ID)

    expect(await refusal('access')).toBe('invalid_token')
    expect(fake.calls).not.toContain('RecordAgentConnectionUse')
  })

  test('marks the connection used on a verified call, then at most once a minute', async () => {
    connect()

    const verifying = createAgentConnectionTokenVerifier(new URL(DOCUMENTS))

    await verifying.verifyAccessToken('access')

    const first = fake.connections.get(CONNECTION_ID)!.lastUsedAt

    expect(first).not.toBeNull()

    await verifying.verifyAccessToken('access')

    expect(fake.calls.filter(name => name === 'RecordAgentConnectionUse')).toHaveLength(1)
    expect(fake.connections.get(CONNECTION_ID)!.lastUsedAt).toBe(first)

    setSystemTime(Date.now() + 61 * 1000)
    await verifying.verifyAccessToken('access')

    expect(fake.calls.filter(name => name === 'RecordAgentConnectionUse')).toHaveLength(2)
    expect(fake.connections.get(CONNECTION_ID)!.lastUsedAt).not.toBe(first)
  })

  test('leaves the minute to the database across instances, each of which asks once', async () => {
    connect()

    await createAgentConnectionTokenVerifier(new URL(DOCUMENTS)).verifyAccessToken('access')

    const first = fake.connections.get(CONNECTION_ID)!.lastUsedAt

    await createAgentConnectionTokenVerifier(new URL(DOCUMENTS)).verifyAccessToken('access')

    expect(fake.calls.filter(name => name === 'RecordAgentConnectionUse')).toHaveLength(2)
    expect(fake.connections.get(CONNECTION_ID)!.lastUsedAt).toBe(first)
  })

  test('verifies the token when marking its connection used fails, and logs it', async () => {
    connect()
    fake.beforeOperation = async name => {
      if (name === 'RecordAgentConnectionUse') throw new Error('unavailable')
    }

    const verifying = createAgentConnectionTokenVerifier(new URL(DOCUMENTS))

    expect(readModuleAccess(await verifying.verifyAccessToken('access')).userId).toBe(MEMBER)
    expect(logged).toHaveBeenCalledTimes(1)
    expect(fake.connections.get(CONNECTION_ID)!.lastUsedAt).toBeNull()
  })

  test('marks nothing used for a token it refuses', async () => {
    connect()

    expect(await refusal('refresh')).toBe('invalid_token')
    expect(await refusal('access', createAgentConnectionTokenVerifier(new URL(TASKS)))).toBe('invalid_token')

    setSystemTime(Date.now() + 61 * 60 * 1000)

    expect(await refusal('access')).toBe('invalid_token')
    expect(fake.calls).not.toContain('RecordAgentConnectionUse')
    expect(fake.connections.get(CONNECTION_ID)!.lastUsedAt).toBeNull()
  })
})
