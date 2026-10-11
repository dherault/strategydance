import { describe, expect, mock, test } from 'bun:test'

const REGISTERED_ID = '0123456789abcdef0123456789abcdef'

const getOAuthClient = mock(async (_dataConnect: unknown, { id }: { id: string }) => ({
  data: {
    oAuthClient: id === REGISTERED_ID ? { id, name: 'Cursor', redirectUris: ['http://127.0.0.1/callback'] } : null,
  },
}))

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => ({ getOAuthClient }))

const { default: resolveOAuthClient } = await import('./resolveOAuthClient')

describe('resolveOAuthClient', () => {
  test('reads a registered client, unverified', async () => {
    expect(await resolveOAuthClient(REGISTERED_ID)).toEqual({
      outcome: 'found',
      client: {
        registeredClientId: REGISTERED_ID,
        name: 'Cursor',
        redirectUris: ['http://127.0.0.1/callback'],
        isVerified: false,
        domain: null,
      },
    })
  })

  test('fetches a client ID metadata document, verified, its domain the address', async () => {
    const clientId = 'https://claude.ai/oauth/mcp-oauth-client-metadata'
    const fetch = mock(async (url: string) => ({
      url,
      status: 200,
      headers: {},
      body: Buffer.from(
        JSON.stringify({
          client_id: clientId,
          client_name: 'Claude',
          redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
          token_endpoint_auth_method: 'none',
        }),
      ),
      isTruncated: false,
    }))

    expect(await resolveOAuthClient(clientId, fetch)).toEqual({
      outcome: 'found',
      client: {
        registeredClientId: null,
        name: 'Claude',
        redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
        isVerified: true,
        domain: 'claude.ai',
      },
    })
  })

  test('knows no unregistered id, no other spelling of one, and no address it could not fetch, fetching nothing', async () => {
    const fetch = mock(async () => {
      throw new Error('fetched')
    })

    for (const clientId of [
      'fedcba9876543210fedcba9876543210',
      '01234567-89ab-cdef-0123-456789abcdef',
      'https://example.com',
      'https://example.com/',
      'http://example.com/client.json',
      'cursor',
    ]) {
      expect(await resolveOAuthClient(clientId, fetch)).toEqual({ outcome: 'unknown' })
    }

    expect(fetch).not.toHaveBeenCalled()
  })

  test("answers a document's refusal", async () => {
    const fetch = mock(async (url: string) => ({
      url,
      status: 404,
      headers: {},
      body: Buffer.from(''),
      isTruncated: false,
    }))

    expect(await resolveOAuthClient('https://example.com/client.json', fetch)).toEqual({
      outcome: 'refused',
      reason: 'It answered 404',
    })
  })
})
