import { afterAll, describe, expect, mock, test } from 'bun:test'

type KmsRequest = { name: string; plaintext?: Buffer; ciphertext?: Buffer; additionalAuthenticatedData: Buffer }

const encrypt = mock(async ({ plaintext, additionalAuthenticatedData }: KmsRequest) => [
  { ciphertext: Buffer.concat([Buffer.from('sealed:'), additionalAuthenticatedData, Buffer.from(':'), plaintext!]) },
])
const decrypt = mock(async ({ ciphertext, additionalAuthenticatedData }: KmsRequest) => {
  const prefix = Buffer.concat([Buffer.from('sealed:'), additionalAuthenticatedData, Buffer.from(':')])

  if (!ciphertext!.subarray(0, prefix.length).equals(prefix)) throw new Error('Decryption failed')

  return [{ plaintext: ciphertext!.subarray(prefix.length) }]
})

mock.module('@google-cloud/kms', () => ({
  KeyManagementServiceClient: class {
    encrypt = encrypt
    decrypt = decrypt
  },
}))

const nodeEnvironment = process.env.NODE_ENV

process.env.NODE_ENV = 'production'

const { default: encryptIntegrationKey } = await import('./encryptIntegrationKey')
const { default: decryptIntegrationKey } = await import('./decryptIntegrationKey')
const { default: encryptIntegrationSecret } = await import('./encryptIntegrationSecret')
const { default: decryptIntegrationSecret } = await import('./decryptIntegrationSecret')

afterAll(() => {
  process.env.NODE_ENV = nodeEnvironment
})

const OWNER = {
  organizationId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  integrationId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
}

describe('the keys of integrations in production', () => {
  test('encrypts a key with Cloud KMS, bound to its organization and server, and opens it there', async () => {
    const encrypted = await encryptIntegrationKey('sk_live_secret', OWNER)

    expect(encrypted).toStartWith('v1:kms:')
    expect(await decryptIntegrationKey(encrypted, OWNER)).toBe('sk_live_secret')

    const [request] = encrypt.mock.calls[0]

    expect(request.name).toBe(
      'projects/strategydance/locations/us-central1/keyRings/integrations/cryptoKeys/integration-secrets',
    )
    expect(request.additionalAuthenticatedData.toString()).toBe(
      'integration-api-key:0f8fad5bd9cb469fa16570867728950e:7c9e6679742540de944be07fc1f90ae7',
    )
  })

  test("binds a member's token to its purpose, the connection's generation and the member", async () => {
    encrypt.mockClear()

    const owner = {
      ...OWNER,
      purpose: 'access-token',
      generation: '3b241101-e2bb-4255-8caf-4136c566a962',
      userId: 'uidOfMember',
    } as const
    const encrypted = await encryptIntegrationSecret('token', owner)

    expect(encrypt.mock.calls[0][0].additionalAuthenticatedData.toString()).toBe(
      'integration-access-token:0f8fad5bd9cb469fa16570867728950e:7c9e6679742540de944be07fc1f90ae7:3b241101e2bb42558caf4136c566a962:uidOfMember',
    )
    expect(await decryptIntegrationSecret(encrypted, owner)).toBe('token')
    await expect(decryptIntegrationSecret(encrypted, { ...owner, purpose: 'refresh-token' })).rejects.toThrow()
  })

  test("refuses to open a key in another server's row", async () => {
    const encrypted = await encryptIntegrationKey('key', OWNER)

    await expect(
      decryptIntegrationKey(encrypted, { ...OWNER, integrationId: '22222222-2222-4222-8222-222222222222' }),
    ).rejects.toThrow()
  })

  test('refuses a key encrypted under the local key, without asking Cloud KMS', async () => {
    decrypt.mockClear()

    await expect(decryptIntegrationKey('v1:local:AAAA', OWNER)).rejects.toThrow('A secret not encrypted with Cloud KMS')
    expect(decrypt).not.toHaveBeenCalled()
  })
})
