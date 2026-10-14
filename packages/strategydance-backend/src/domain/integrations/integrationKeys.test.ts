import { describe, expect, test } from 'bun:test'

import decryptIntegrationKey from './decryptIntegrationKey'
import encryptIntegrationKey from './encryptIntegrationKey'

const OWNER = {
  organizationId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  integrationId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
}

describe('the keys of integrations outside production', () => {
  test('encrypts a key under the local key, and opens it again', async () => {
    const encrypted = await encryptIntegrationKey('sk_live_secret', OWNER)

    expect(encrypted).toStartWith('v1:local:')
    expect(encrypted).not.toContain('sk_live_secret')
    expect(await decryptIntegrationKey(encrypted, OWNER)).toBe('sk_live_secret')
  })

  test('encrypts a key differently each time', async () => {
    expect(await encryptIntegrationKey('same', OWNER)).not.toBe(await encryptIntegrationKey('same', OWNER))
  })

  test('opens a key whichever spelling of its ids the route was called with', async () => {
    const encrypted = await encryptIntegrationKey('key', OWNER)
    const dashless = {
      organizationId: OWNER.organizationId.replaceAll('-', '').toUpperCase(),
      integrationId: OWNER.integrationId.replaceAll('-', ''),
    }

    expect(await decryptIntegrationKey(encrypted, dashless)).toBe('key')
  })

  test("refuses to open a key in another organization's row or another server's", async () => {
    const encrypted = await encryptIntegrationKey('key', OWNER)

    await expect(
      decryptIntegrationKey(encrypted, { ...OWNER, organizationId: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toThrow()
    await expect(
      decryptIntegrationKey(encrypted, { ...OWNER, integrationId: '22222222-2222-4222-8222-222222222222' }),
    ).rejects.toThrow()
  })

  test('refuses a key tampered with', async () => {
    const encrypted = await encryptIntegrationKey('key', OWNER)
    const sealed = Buffer.from(encrypted.slice('v1:local:'.length), 'base64')

    sealed[sealed.length - 1] ^= 1

    await expect(decryptIntegrationKey(`v1:local:${sealed.toString('base64')}`, OWNER)).rejects.toThrow()
  })

  test('refuses a key encrypted with Cloud KMS, which only production opens', async () => {
    await expect(decryptIntegrationKey('v1:kms:AAAA', OWNER)).rejects.toThrow(
      'A secret not encrypted with the local key',
    )
  })
})
