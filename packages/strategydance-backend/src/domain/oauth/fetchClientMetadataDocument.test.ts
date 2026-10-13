import { afterEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { default: fetchClientMetadataDocument } = await import('./fetchClientMetadataDocument')
const { OutboundRefusal } = await import('~utils/fetchOutbound')

type Fetch = NonNullable<Parameters<typeof fetchClientMetadataDocument>[1]>

let clients = 0

// An address no other test has read, since the documents read are kept for the whole file
function createClientId() {
  clients++

  return `https://client${clients}.example.com/oauth/metadata.json`
}

function createDocument(clientId: string, fields: Record<string, unknown> = {}) {
  return {
    client_id: clientId,
    client_name: 'Example Agent',
    redirect_uris: ['https://client.example.com/callback', 'http://127.0.0.1/callback'],
    token_endpoint_auth_method: 'none',
    ...fields,
  }
}

function answer(body: unknown, { status = 200, isTruncated = false } = {}): Fetch {
  return mock(async (url: string) => ({
    url,
    status,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
    isTruncated,
  }))
}

describe('fetchClientMetadataDocument', () => {
  afterEach(() => {
    setSystemTime()
  })

  test('fetches a document with no redirect, up to 5 KB, and keeps it for an hour', async () => {
    const clientId = createClientId()
    const fetch = answer(createDocument(clientId))

    expect(await fetchClientMetadataDocument(clientId, fetch)).toEqual({
      outcome: 'valid',
      document: {
        name: 'Example Agent',
        redirectUris: ['https://client.example.com/callback', 'http://127.0.0.1/callback'],
      },
    })
    expect(fetch).toHaveBeenCalledWith(clientId, expect.objectContaining({ maxRedirects: 0, maxBytes: 5120 }))

    await fetchClientMetadataDocument(clientId, fetch)

    expect(fetch).toHaveBeenCalledTimes(1)

    setSystemTime(Date.now() + 61 * 60 * 1000)
    await fetchClientMetadataDocument(clientId, fetch)

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('cleans the name it shows', async () => {
    const clientId = createClientId()

    expect(
      await fetchClientMetadataDocument(clientId, answer(createDocument(clientId, { client_name: 'Good‮evil' }))),
    ).toEqual({ outcome: 'valid', document: expect.objectContaining({ name: 'Goodevil' }) })
  })

  test('refuses a document whose client_id is not its address', async () => {
    const clientId = createClientId()

    for (const other of [`${clientId}?x`, clientId.toUpperCase(), 'https://other.example.com/oauth/metadata.json']) {
      expect(await fetchClientMetadataDocument(clientId, answer(createDocument(other)))).toEqual({
        outcome: 'refused',
        reason: 'Its client_id is not its address',
      })
      setSystemTime(Date.now() + 2 * 60 * 1000)
    }
  })

  test('refuses a body cut short, an error status, a redirect, and what is not a JSON object', async () => {
    const redirect: Fetch = mock(async () => {
      throw new OutboundRefusal('More than 0 redirects from https://example.com', 'redirects')
    })

    for (const fetch of [
      answer(createDocument('x'), { isTruncated: true }),
      answer(createDocument('x'), { status: 404 }),
      answer('', { status: 302 }),
      redirect,
      answer('{ not json'),
      answer('[]'),
      answer('null'),
    ]) {
      expect(await fetchClientMetadataDocument(createClientId(), fetch)).toEqual({
        outcome: 'refused',
        reason: expect.any(String),
      })
    }
  })

  test('refuses a document lacking client_id, client_name or redirect_uris, or with a redirect it may not name', async () => {
    for (const fields of [
      { client_id: undefined },
      { client_name: undefined },
      { client_name: '‮' },
      { redirect_uris: undefined },
      { redirect_uris: [] },
      { redirect_uris: ['cursor://callback'] },
      { redirect_uris: ['http://example.com/callback'] },
      { redirect_uris: Array.from({ length: 11 }, (_, index) => `https://example.com/${index}`) },
    ]) {
      const clientId = createClientId()

      expect((await fetchClientMetadataDocument(clientId, answer(createDocument(clientId, fields)))).outcome).toBe(
        'refused',
      )
    }
  })

  test('refuses a token endpoint authentication other than none, or none declared', async () => {
    for (const method of [undefined, 'client_secret_basic', 'private_key_jwt']) {
      const clientId = createClientId()

      expect(
        await fetchClientMetadataDocument(
          clientId,
          answer(createDocument(clientId, { token_endpoint_auth_method: method })),
        ),
      ).toEqual({ outcome: 'refused', reason: 'Its token_endpoint_auth_method is not none' })
    }
  })

  test('keeps a failure for a minute', async () => {
    const clientId = createClientId()
    const failing = answer('', { status: 500 })

    await fetchClientMetadataDocument(clientId, failing)
    await fetchClientMetadataDocument(clientId, failing)

    expect(failing).toHaveBeenCalledTimes(1)

    setSystemTime(Date.now() + 61 * 1000)

    expect(await fetchClientMetadataDocument(clientId, answer(createDocument(clientId)))).toEqual(
      expect.objectContaining({ outcome: 'valid' }),
    )
  })
})
