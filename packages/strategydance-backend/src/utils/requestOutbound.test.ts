import { describe, expect, mock, test } from 'bun:test'

import requestOutbound, { OutboundRefusal, type OutboundStream, type ResolvedAddress } from './requestOutbound'

const PUBLIC = { address: '93.184.215.14', family: 4 }

function createResolver(table: Record<string, ResolvedAddress[]>) {
  return mock(async (hostname: string) => table[hostname] ?? [])
}

function createSender(status = 200) {
  return mock(async (): Promise<OutboundStream> => ({
    status,
    headers: {},
    body: (async function* () {})(),
  }))
}

function signal() {
  return AbortSignal.timeout(1000)
}

describe('requestOutbound', () => {
  test('refuses a name on its own network before resolving it', async () => {
    for (const address of [
      'https://localhost/',
      'https://LOCALHOST./',
      'https://app.localhost/',
      'https://printer.local/',
      'https://metadata.google.internal/computeMetadata/v1/',
      'https://METADATA.GOOGLE.INTERNAL./',
      'https://router.home.arpa/',
      'https://metadata/computeMetadata/v1/',
      'https://intranet/',
    ]) {
      const resolve = createResolver({})
      const send = createSender()

      await expect(requestOutbound(address, { signal: signal(), resolve, send })).rejects.toMatchObject({
        name: 'OutboundRefusal',
        reason: 'privateAddress',
      })
      expect(resolve).not.toHaveBeenCalled()
      expect(send).not.toHaveBeenCalled()
    }
  })

  test('refuses a name resolving to the metadata server', async () => {
    const send = createSender()

    await expect(
      requestOutbound('https://metadata.example.com/', {
        signal: signal(),
        resolve: createResolver({ 'metadata.example.com': [{ address: '169.254.169.254', family: 4 }] }),
        send,
      }),
    ).rejects.toBeInstanceOf(OutboundRefusal)
    expect(send).not.toHaveBeenCalled()
  })

  test('sends any method, with its body and the body length, to the address it checked', async () => {
    const send = createSender(202)
    const body = new TextEncoder().encode('{"jsonrpc":"2.0"}')

    const response = await requestOutbound('https://mcp.example.com/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: signal(),
      resolve: createResolver({ 'mcp.example.com': [PUBLIC] }),
      send,
    })

    expect(response.status).toBe(202)
    expect(response.url.href).toBe('https://mcp.example.com/mcp')

    const [url, address, headers, , request] = send.mock.calls[0] as unknown as Parameters<
      NonNullable<Parameters<typeof requestOutbound>[1]['send']>
    >

    expect(url.href).toBe('https://mcp.example.com/mcp')
    expect(address).toEqual(PUBLIC)
    expect(headers).toEqual({
      'content-type': 'application/json',
      'accept-encoding': 'identity',
      'content-length': String(body.byteLength),
    })
    expect(request).toEqual({ method: 'POST', body })
  })

  test('answers a redirect as it came rather than following it', async () => {
    const send = mock(async (): Promise<OutboundStream> => ({
      status: 307,
      headers: { location: 'https://elsewhere.example.com/' },
      body: (async function* () {})(),
    }))

    const response = await requestOutbound('https://mcp.example.com/', {
      signal: signal(),
      resolve: createResolver({ 'mcp.example.com': [PUBLIC] }),
      send,
    })

    expect(response.status).toBe(307)
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('keeps to the protocols it is given', async () => {
    await expect(
      requestOutbound('http://mcp.example.com/', {
        protocols: ['https:'],
        signal: signal(),
        resolve: createResolver({ 'mcp.example.com': [PUBLIC] }),
        send: createSender(),
      }),
    ).rejects.toBeInstanceOf(OutboundRefusal)
  })

  test('names the origin alone when it refuses, never a path or a query', async () => {
    const refusal = await requestOutbound('https://key.example.com:8443/mcp?key=secret', {
      signal: signal(),
      resolve: createResolver({}),
      send: createSender(),
    }).catch((error: unknown) => error)

    expect(refusal).toBeInstanceOf(OutboundRefusal)
    expect((refusal as Error).message).not.toContain('secret')
  })
})
