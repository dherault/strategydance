import { describe, expect, test } from 'bun:test'

import decryptIntegrationKey from './decryptIntegrationKey'
import decryptIntegrationSecret from './decryptIntegrationSecret'
import encryptIntegrationKey from './encryptIntegrationKey'
import encryptIntegrationSecret from './encryptIntegrationSecret'

const SERVER = {
  organizationId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  integrationId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
}

const TOKEN = {
  ...SERVER,
  purpose: 'access-token',
  generation: '3b241101-e2bb-4255-8caf-4136c566a962',
  userId: 'uidOfMember',
} as const

const VERIFIER = {
  ...SERVER,
  purpose: 'code-verifier',
  authorizationId: '9b2f6a1c-4f5e-4c7d-8a9b-0c1d2e3f4a5b',
  userId: 'uidOfMember',
} as const

describe('the secrets of integrations outside production, each bound to what it is and whose', () => {
  test('opens a secret as what it was encrypted as, for whom it was', async () => {
    expect(await decryptIntegrationSecret(await encryptIntegrationSecret('token', TOKEN), TOKEN)).toBe('token')
    expect(await decryptIntegrationSecret(await encryptIntegrationSecret('verifier', VERIFIER), VERIFIER)).toBe(
      'verifier',
    )
  })

  test('never opens one purpose as another, an access token as a refresh token or a key', async () => {
    const encrypted = await encryptIntegrationSecret('token', TOKEN)

    await expect(decryptIntegrationSecret(encrypted, { ...TOKEN, purpose: 'refresh-token' })).rejects.toThrow()
    await expect(decryptIntegrationKey(encrypted, SERVER)).rejects.toThrow()
    await expect(
      decryptIntegrationSecret(await encryptIntegrationKey('key', SERVER), { ...SERVER, purpose: 'client-secret' }),
    ).rejects.toThrow()
  })

  test("never opens a member's token for another member or another generation", async () => {
    const encrypted = await encryptIntegrationSecret('token', TOKEN)

    await expect(decryptIntegrationSecret(encrypted, { ...TOKEN, userId: 'uidOfAnother' })).rejects.toThrow()
    await expect(
      decryptIntegrationSecret(encrypted, { ...TOKEN, generation: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toThrow()
  })

  test("never opens a Connect's verifier for another Connect, nor as the code it brought back", async () => {
    const encrypted = await encryptIntegrationSecret('verifier', VERIFIER)

    await expect(
      decryptIntegrationSecret(encrypted, { ...VERIFIER, authorizationId: '22222222-2222-4222-8222-222222222222' }),
    ).rejects.toThrow()
    await expect(decryptIntegrationSecret(encrypted, { ...VERIFIER, purpose: 'authorization-code' })).rejects.toThrow()
  })

  test('opens a secret whichever spelling of its ids it is read with', async () => {
    const encrypted = await encryptIntegrationSecret('token', TOKEN)

    expect(
      await decryptIntegrationSecret(encrypted, {
        ...TOKEN,
        organizationId: TOKEN.organizationId.replaceAll('-', '').toUpperCase(),
        generation: TOKEN.generation.replaceAll('-', ''),
      }),
    ).toBe('token')
  })
})
