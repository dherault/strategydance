import { beforeEach, describe, expect, mock, test } from 'bun:test'

import createIntegrationDatabaseFake, {
  IntegrationAuthentication,
  IntegrationConnectionStatus,
  OrganizationRole,
} from './testing/createIntegrationDatabaseFake'
import createIntegrationOAuthServerFake, { FAKE_ISSUER, FAKE_MCP_URL } from './testing/createIntegrationOAuthServerFake'

/*
  What becomes of a refresh whose tokens cannot be encrypted, as Cloud KMS failing would leave it:
  encryption stands in reversibly here, so it can fail on the refreshed tokens alone
*/

const fake = createIntegrationDatabaseFake()
let provider = createIntegrationOAuthServerFake()
let isEncryptionFailing = false

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/integrations/encryptIntegrationSecret', () => ({
  default: async (secret: string, { purpose }: { purpose: string }) => {
    if (isEncryptionFailing && (purpose === 'access-token' || purpose === 'refresh-token')) {
      throw new Error('Cloud KMS is down')
    }

    return `sealed:${purpose}:${Buffer.from(secret).toString('base64')}`
  },
}))
mock.module('~domain/integrations/decryptIntegrationSecret', () => ({
  default: async (sealed: string, { purpose }: { purpose: string }) => {
    const prefix = `sealed:${purpose}:`

    if (!sealed.startsWith(prefix)) throw new Error('Not this purpose')

    return Buffer.from(sealed.slice(prefix.length), 'base64').toString('utf8')
  },
}))

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

const { default: startIntegrationConnection } = await import('./startIntegrationConnection')
const { default: receiveIntegrationAuthorizationCode } = await import('./receiveIntegrationAuthorizationCode')
const { default: finishIntegrationConnection } = await import('./finishIntegrationConnection')
const { default: readIntegrationAccessToken } = await import('./readIntegrationAccessToken')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const INTEGRATION_ID = '7c9e6679742540de944be07fc1f90ae7'
const ADA = 'ada'
const CALLER = { organizationId: ORGANIZATION_ID, userId: ADA, integrationId: INTEGRATION_ID }

beforeEach(() => {
  fake.reset()
  fake.addMember(ADA, ORGANIZATION_ID, OrganizationRole.ADMINISTRATOR)
  isEncryptionFailing = false
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
    tools: '[]',
    toolCount: 0,
    toolDefinitionHashes: [],
    autoApprovedTools: [],
    lastError: null,
    deletedAt: null,
  })
})

const connection = () => fake.connections.get(`${INTEGRATION_ID}:${ADA}`)!

const open = (sealed: string, purpose: string) =>
  Buffer.from(sealed.slice(`sealed:${purpose}:`.length), 'base64').toString('utf8')

// Connects Ada, then sets her access token to expire inside the minute a refresh comes before
async function connectExpiring() {
  const started = await startIntegrationConnection(CALLER)

  if (started.outcome !== 'started') throw new Error('Not started')

  const { authorization } = await receiveIntegrationAuthorizationCode(provider.approve(started.authorizationUrl))

  expect((await finishIntegrationConnection({ ...CALLER, authorizationId: authorization! })).outcome).toBe('connected')
  connection().accessTokenExpiresAt = new Date(Date.now() + 10_000).toISOString()
}

describe('a refresh whose tokens cannot be encrypted', () => {
  test('revokes the rotated grant it got, and has the member connect again, its stored token spent', async () => {
    await connectExpiring()

    const stored = open(connection().encryptedRefreshToken!, 'refresh-token')

    isEncryptionFailing = true

    expect(await readIntegrationAccessToken(CALLER)).toEqual({ outcome: 'needsAuthentication' })
    expect(provider.isCurrentRefreshToken(stored)).toBe(false)
    expect(provider.recorded.revocations).toHaveLength(1)
    expect(provider.recorded.revocations[0]).toMatchObject({ token_type_hint: 'refresh_token' })
    expect(provider.recorded.revocations[0].token).not.toBe(stored)
    expect(connection()).toMatchObject({
      status: IntegrationConnectionStatus.NEEDS_AUTHENTICATION,
      refreshLeaseId: null,
    })
  })

  test('revokes only the new access token where the refresh token was not rotated, and keeps it', async () => {
    provider = createIntegrationOAuthServerFake({ isRotating: false })
    await connectExpiring()

    const stored = open(connection().encryptedRefreshToken!, 'refresh-token')

    isEncryptionFailing = true

    expect(await readIntegrationAccessToken(CALLER)).toEqual({ outcome: 'keyUnavailable' })
    expect(provider.recorded.revocations).toHaveLength(1)
    expect(provider.recorded.revocations[0]).toMatchObject({ token_type_hint: 'access_token' })
    expect(provider.isCurrentRefreshToken(stored)).toBe(true)
    expect(connection()).toMatchObject({
      status: IntegrationConnectionStatus.CONNECTED,
      refreshingUntil: null,
      refreshLeaseId: null,
    })

    isEncryptionFailing = false

    expect((await readIntegrationAccessToken(CALLER)).outcome).toBe('ready')
  })
})
