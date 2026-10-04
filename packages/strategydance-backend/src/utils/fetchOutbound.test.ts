import { describe, expect, mock, test } from 'bun:test'

import fetchOutbound, { OutboundRefusal, type OutboundStream, type ResolvedAddress } from './fetchOutbound'

const OPTIONS = { maxBytes: 1000, timeoutMs: 1000, maxRedirects: 3 }

const PUBLIC = { address: '93.184.215.14', family: 4 }

// A resolver answering from a table, by hostname
function createResolver(table: Record<string, ResolvedAddress[]>) {
  return mock(async (hostname: string) => table[hostname] ?? [])
}

// A response with a body in chunks
function respond(status: number, headers: Record<string, string> = {}, chunks: string[] = []): OutboundStream {
  return {
    status,
    headers,
    body: (async function* () {
      for (const chunk of chunks) yield new TextEncoder().encode(chunk)
    })(),
  }
}

// A transport answering each request in turn, and keeping what it was sent to
function createSender(...responses: OutboundStream[]) {
  return mock(async (_url: URL, _address: ResolvedAddress, _headers: Record<string, string>, _signal: AbortSignal) => {
    const response = responses.shift()

    if (!response) throw new Error('No response left')

    return response
  })
}

describe('fetchOutbound', () => {
  test('fetches a public address from the address it checked, uncompressed', async () => {
    const resolve = createResolver({ 'example.com': [PUBLIC] })
    const send = createSender(respond(200, { 'content-type': 'text/html' }, ['<html>', '</html>']))

    const response = await fetchOutbound('https://example.com/page', {
      ...OPTIONS,
      headers: { accept: 'text/html' },
      resolve,
      send,
    })

    expect(response).toMatchObject({ url: 'https://example.com/page', status: 200, isTruncated: false })
    expect(response.body.toString()).toBe('<html></html>')
    expect(send.mock.calls[0][1]).toEqual(PUBLIC)
    expect(send.mock.calls[0][2]).toEqual({ accept: 'text/html', 'accept-encoding': 'identity' })
  })

  test('refuses a hostname resolving to any address that is not public, sending nothing', async () => {
    for (const addresses of [
      [{ address: '127.0.0.1', family: 4 }],
      [{ address: '169.254.169.254', family: 4 }],
      [{ address: '10.1.2.3', family: 4 }],
      [{ address: '::1', family: 6 }],
      [{ address: '::ffff:192.168.0.1', family: 6 }],
      [PUBLIC, { address: '10.0.0.1', family: 4 }],
      [],
    ]) {
      const send = createSender()

      await expect(
        fetchOutbound('https://internal.example/', {
          ...OPTIONS,
          resolve: createResolver({ 'internal.example': addresses }),
          send,
        }),
      ).rejects.toBeInstanceOf(OutboundRefusal)
      expect(send).not.toHaveBeenCalled()
    }
  })

  test('refuses an address written as an IP that is not public, without resolving it', async () => {
    for (const address of [
      'http://127.0.0.1/',
      'http://[::1]/',
      'http://169.254.169.254/computeMetadata/v1/',
      'http://2130706433/',
      'http://0x7f.1/',
      'http://[::ffff:127.0.0.1]/',
      'http://0.0.0.0/',
    ]) {
      const resolve = createResolver({})

      await expect(fetchOutbound(address, { ...OPTIONS, resolve, send: createSender() })).rejects.toBeInstanceOf(
        OutboundRefusal,
      )
      expect(resolve).not.toHaveBeenCalled()
    }
  })

  test('refuses another protocol, another port, and credentials', async () => {
    for (const address of [
      'ftp://example.com/',
      'file:///etc/passwd',
      'gopher://example.com/',
      'https://example.com:8443/',
      'http://example.com:22/',
      'https://user:secret@example.com/',
      'not a url',
    ]) {
      await expect(
        fetchOutbound(address, {
          ...OPTIONS,
          resolve: createResolver({ 'example.com': [PUBLIC] }),
          send: createSender(),
        }),
      ).rejects.toBeInstanceOf(OutboundRefusal)
    }
  })

  test('connects to the address it checked, whatever the resolver would answer next', async () => {
    let calls = 0
    const resolve = mock(async () => (calls++ ? [{ address: '127.0.0.1', family: 4 }] : [PUBLIC]))
    const send = createSender(respond(200, {}, ['ok']))

    await fetchOutbound('https://rebinding.example/', { ...OPTIONS, resolve, send })

    expect(resolve).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][1]).toEqual(PUBLIC)
  })

  test('follows a redirect, relative ones included, checking each address', async () => {
    const resolve = createResolver({ 'example.com': [PUBLIC], 'www.example.com': [PUBLIC] })
    const send = createSender(
      respond(301, { location: 'https://www.example.com/start' }),
      respond(302, { location: '/end' }),
      respond(200, {}, ['done']),
    )

    const response = await fetchOutbound('http://example.com/', { ...OPTIONS, resolve, send })

    expect(response.url).toBe('https://www.example.com/end')
    expect(send.mock.calls.map(([url]) => url.href)).toEqual([
      'http://example.com/',
      'https://www.example.com/start',
      'https://www.example.com/end',
    ])
  })

  test('refuses a redirect to an address that is not public', async () => {
    const send = createSender(respond(302, { location: 'http://169.254.169.254/computeMetadata/v1/' }))

    await expect(
      fetchOutbound('https://example.com/', { ...OPTIONS, resolve: createResolver({ 'example.com': [PUBLIC] }), send }),
    ).rejects.toBeInstanceOf(OutboundRefusal)
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('refuses more redirects than it follows', async () => {
    const send = createSender(...Array.from({ length: 5 }, () => respond(302, { location: '/again' })))

    await expect(
      fetchOutbound('https://example.com/', {
        ...OPTIONS,
        maxRedirects: 2,
        resolve: createResolver({ 'example.com': [PUBLIC] }),
        send,
      }),
    ).rejects.toThrow('More than 2 redirects')
    expect(send).toHaveBeenCalledTimes(3)
  })

  test('cuts a body past the cap, and says so', async () => {
    const send = createSender(respond(200, {}, ['a'.repeat(600), 'b'.repeat(600), 'c'.repeat(600)]))

    const response = await fetchOutbound('https://example.com/', {
      ...OPTIONS,
      resolve: createResolver({ 'example.com': [PUBLIC] }),
      send,
    })

    expect(response.isTruncated).toBe(true)
    expect(response.body.toString()).toBe('a'.repeat(600) + 'b'.repeat(400))
  })

  test('gives up past its deadline while the hostname resolves', async () => {
    const send = createSender()

    await expect(
      fetchOutbound('https://stalled.example/', {
        ...OPTIONS,
        timeoutMs: 20,
        // A resolver that never answers
        resolve: () => new Promise<ResolvedAddress[]>(() => {}),
        send,
      }),
    ).rejects.toThrow()
    expect(send).not.toHaveBeenCalled()
  })

  test('gives up past its deadline', async () => {
    // A server that never answers, but to the signal
    const send = mock(
      (_url: URL, _address: ResolvedAddress, _headers: Record<string, string>, signal: AbortSignal) =>
        new Promise<OutboundStream>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason))
        }),
    )

    await expect(
      fetchOutbound('https://slow.example/', {
        ...OPTIONS,
        timeoutMs: 20,
        resolve: createResolver({ 'slow.example': [PUBLIC] }),
        send,
      }),
    ).rejects.toThrow()
  })
})
