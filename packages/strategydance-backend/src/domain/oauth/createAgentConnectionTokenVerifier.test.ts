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
const { default: readModuleCaller } = await import('~modules/readModuleCaller')

const KNOWLEDGE = 'http://localhost:3003/mcp/knowledge'
const TASKS = 'http://localhost:3003/mcp/tasks'
const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const MEMBER = 'member'
const CONNECTION_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const verifier = createAgentConnectionTokenVerifier(new URL(KNOWLEDGE))

function hash(token: string) {
  return createHash('sha256').update(token).digest('base64url')
}

// A connection of the member's, holding a token of each kind, as a code's exchange stores them
function connect({
  scopes = ['knowledge:read'],
  resource = KNOWLEDGE,
  accessScopes,
}: { scopes?: string[]; resource?: string; accessScopes?: string[] } = {}) {
  fake.connections.set(CONNECTION_ID, {
    id: CONNECTION_ID,
    userId: MEMBER,
    organizationId: ORGANIZATION_ID,
    clientId: 'https://client.example.com/oauth/metadata.json',
    registeredClientId: null,
    clientName: 'Example Agent',
    module: 'knowledge',
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
  fake.setStaff(MEMBER)
})

afterEach(() => {
  setSystemTime()
})

describe('createAgentConnectionTokenVerifier', () => {
  test("accepts a valid access token, carrying the row's expiry and resource and the member's caller", async () => {
    connect({ scopes: ['knowledge:read', 'knowledge:write'] })

    const authInfo = await verifier.verifyAccessToken('access')

    expect(authInfo).toMatchObject({
      token: 'access',
      clientId: 'https://client.example.com/oauth/metadata.json',
      scopes: ['knowledge:read', 'knowledge:write'],
      expiresAt: Math.floor(Date.parse(fake.tokens.get('ACCESS')!.expiresAt) / 1000),
      resource: new URL(KNOWLEDGE),
    })
    expect(readModuleCaller(authInfo)).toEqual({
      kind: 'external',
      userId: MEMBER,
      organizationId: ORGANIZATION_ID,
      membershipCreatedAt,
      scopes: ['knowledge:read', 'knowledge:write'],
      idempotencyScope: `connection:${CONNECTION_ID}`,
    })
  })

  test("carries the scopes a refresh narrowed the token to, within its connection's", async () => {
    connect({ scopes: ['knowledge:read', 'knowledge:write'], accessScopes: ['knowledge:read'] })

    const authInfo = await verifier.verifyAccessToken('access')

    expect(authInfo.scopes).toEqual(['knowledge:read'])
    expect(readModuleCaller(authInfo).scopes).toEqual(['knowledge:read'])
  })

  test('refuses a token for another module', async () => {
    connect()

    expect(await refusal('access', createAgentConnectionTokenVerifier(new URL(TASKS)))).toBe('invalid_token')
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

  test('refuses an account that is no longer staff, while modules are theirs alone', async () => {
    connect()
    fake.setStaff(MEMBER, false)

    expect(await refusal('access')).toBe('invalid_token')
  })

  test('marks the connection used on a verified call, then at most once a minute', async () => {
    connect()

    const verifying = createAgentConnectionTokenVerifier(new URL(KNOWLEDGE))

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

    await createAgentConnectionTokenVerifier(new URL(KNOWLEDGE)).verifyAccessToken('access')

    const first = fake.connections.get(CONNECTION_ID)!.lastUsedAt

    await createAgentConnectionTokenVerifier(new URL(KNOWLEDGE)).verifyAccessToken('access')

    expect(fake.calls.filter(name => name === 'RecordAgentConnectionUse')).toHaveLength(2)
    expect(fake.connections.get(CONNECTION_ID)!.lastUsedAt).toBe(first)
  })

  test('verifies the token when marking its connection used fails, and logs it', async () => {
    connect()
    fake.beforeOperation = async name => {
      if (name === 'RecordAgentConnectionUse') throw new Error('unavailable')
    }

    const verifying = createAgentConnectionTokenVerifier(new URL(KNOWLEDGE))

    expect(readModuleCaller(await verifying.verifyAccessToken('access')).userId).toBe(MEMBER)
    expect(logged).toHaveBeenCalledTimes(1)
    expect(fake.connections.get(CONNECTION_ID)!.lastUsedAt).toBeNull()
  })

  test('marks nothing used for a token it refuses', async () => {
    connect()
    fake.setStaff(MEMBER, false)

    expect(await refusal('access')).toBe('invalid_token')
    expect(await refusal('refresh')).toBe('invalid_token')
    expect(await refusal('access', createAgentConnectionTokenVerifier(new URL(TASKS)))).toBe('invalid_token')
    expect(fake.calls).not.toContain('RecordAgentConnectionUse')
    expect(fake.connections.get(CONNECTION_ID)!.lastUsedAt).toBeNull()
  })
})
