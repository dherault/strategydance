import { describe, expect, mock, test } from 'bun:test'

import createGuardedFetch from './createGuardedFetch'
import { OutboundRefusal, type OutboundRequest, type OutboundStream, type ResolvedAddress } from './requestOutbound'

const PUBLIC = { address: '93.184.215.14', family: 4 }

const OPTIONS = { maxBytes: 1000, timeoutMs: 1000 }

function createResolver(table: Record<string, ResolvedAddress[]>) {
  return mock(async (hostname: string) => table[hostname] ?? [])
}

type Sent = { url: URL; address: ResolvedAddress; headers: Record<string, string>; request: OutboundRequest }

// A server answering each request in turn, keeping what each was sent
function createServer(...responses: OutboundStream[]) {
  const sent: Sent[] = []
  const send = mock(
    async (
      url: URL,
      address: ResolvedAddress,
      headers: Record<string, string>,
      _signal: AbortSignal,
      request: OutboundRequest,
    ) => {
      sent.push({ url, address, headers, request })

      const response = responses.shift()

      if (!response) throw new Error('No response left')

      return response
    },
  )

  return { send, sent }
}

function respond(status: number, headers: Record<string, string> = {}, chunks: string[] = []): OutboundStream {
  return {
    status,
    headers,
    body: (async function* () {
      for (const chunk of chunks) yield new TextEncoder().encode(chunk)
    })(),
  }
}

const resolve = createResolver({ 'mcp.example.com': [PUBLIC] })

describe('createGuardedFetch', () => {
  test('sends a request to the address it checked, and answers a response', async () => {
    const { send, sent } = createServer(respond(200, { 'content-type': 'application/json' }, ['{"ok":', 'true}']))
    const fetch = createGuardedFetch({ ...OPTIONS, resolve, send })

    const response = await fetch(new URL('https://mcp.example.com/mcp'), {
      method: 'post',
      headers: new Headers({ 'Content-Type': 'application/json', Authorization: 'Bearer key' }),
      body: '{"jsonrpc":"2.0"}',
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(await response.json()).toEqual({ ok: true })
    expect(sent[0].address).toEqual(PUBLIC)
    expect(sent[0].request).toEqual({ method: 'POST', body: new TextEncoder().encode('{"jsonrpc":"2.0"}') })
    expect(sent[0].headers).toMatchObject({
      'content-type': 'application/json',
      authorization: 'Bearer key',
      'user-agent': expect.stringContaining('StrategyDance'),
      'accept-encoding': 'identity',
      'content-length': '17',
    })
  })

  test('reads headers given as an object, and sends a form as one', async () => {
    const { send, sent } = createServer(respond(200))
    const fetch = createGuardedFetch({ ...OPTIONS, resolve, send })

    await fetch('https://mcp.example.com/token', {
      method: 'POST',
      headers: { 'User-Agent': 'Client/2' },
      body: new URLSearchParams({ grant_type: 'refresh_token' }),
    })

    expect(sent[0].headers['user-agent']).toBe('Client/2')
    expect(sent[0].headers['content-type']).toStartWith('application/x-www-form-urlencoded')
    expect(new TextDecoder().decode(sent[0].request.body)).toBe('grant_type=refresh_token')
  })

  test('refuses an address that is not https, sending nothing', async () => {
    const { send } = createServer()
    const fetch = createGuardedFetch({ ...OPTIONS, resolve, send })

    for (const address of [
      'http://mcp.example.com/mcp',
      'https://mcp.example.com:8443/mcp',
      'ftp://mcp.example.com/',
    ]) {
      await expect(fetch(address)).rejects.toBeInstanceOf(OutboundRefusal)
    }

    expect(send).not.toHaveBeenCalled()
  })

  test('refuses a name resolving to any special-use address, in IPv4 and IPv6, sending nothing', async () => {
    for (const address of [
      // Private, loopback, link-local and the metadata server, carrier-grade NAT
      '10.1.2.3',
      '172.16.5.4',
      '192.168.1.1',
      '127.0.0.1',
      '169.254.169.254',
      '100.64.0.1',
      // Multicast, documentation, unspecified
      '224.0.0.251',
      '192.0.2.10',
      '198.51.100.7',
      '0.0.0.0',
      // IPv6: unspecified, loopback, link-local, unique local, multicast, documentation
      '::',
      '::1',
      'fe80::1',
      'fd00::1',
      'ff02::fb',
      '2001:db8::1',
      // IPv4 written as IPv6
      '::ffff:127.0.0.1',
      '::ffff:10.0.0.1',
      '::ffff:169.254.169.254',
    ]) {
      const { send } = createServer()
      const fetch = createGuardedFetch({
        ...OPTIONS,
        resolve: createResolver({ 'mcp.example.com': [{ address, family: address.includes(':') ? 6 : 4 }] }),
        send,
      })

      await expect(fetch('https://mcp.example.com/mcp')).rejects.toBeInstanceOf(OutboundRefusal)
      expect(send).not.toHaveBeenCalled()
    }
  })

  test('refuses a special-use address written in the URL, without resolving it', async () => {
    for (const address of [
      'https://127.0.0.1/mcp',
      'https://[::1]/mcp',
      'https://169.254.169.254/computeMetadata/v1/',
      'https://[::ffff:127.0.0.1]/mcp',
      'https://[fd00::1]/mcp',
      'https://0.0.0.0/mcp',
      'https://[::]/mcp',
    ]) {
      const unused = createResolver({})
      const fetch = createGuardedFetch({ ...OPTIONS, resolve: unused, send: createServer().send })

      await expect(fetch(address)).rejects.toBeInstanceOf(OutboundRefusal)
      expect(unused).not.toHaveBeenCalled()
    }
  })

  test("refuses the metadata server's names, and one-label names, without resolving them", async () => {
    for (const address of [
      'https://metadata.google.internal/computeMetadata/v1/',
      'https://metadata/computeMetadata/v1/',
      'https://localhost/mcp',
    ]) {
      const unused = createResolver({})
      const fetch = createGuardedFetch({ ...OPTIONS, resolve: unused, send: createServer().send })

      await expect(fetch(address)).rejects.toBeInstanceOf(OutboundRefusal)
      expect(unused).not.toHaveBeenCalled()
    }
  })

  test('connects to the address it checked, whatever the resolver would answer next', async () => {
    let calls = 0
    const rebinding = mock(async () => (calls++ ? [{ address: '127.0.0.1', family: 4 }] : [PUBLIC]))
    const { send, sent } = createServer(respond(200))
    const fetch = createGuardedFetch({ ...OPTIONS, resolve: rebinding, send })

    await fetch('https://rebinding.example.com/mcp')

    expect(rebinding).toHaveBeenCalledTimes(1)
    expect(sent[0].address).toEqual(PUBLIC)
  })

  test('answers a redirect rather than following it, and refuses the hop when it reaches a blocked address', async () => {
    const { send } = createServer(respond(307, { location: 'https://internal.example.com/mcp' }))
    const fetch = createGuardedFetch({
      ...OPTIONS,
      resolve: createResolver({
        'mcp.example.com': [PUBLIC],
        'internal.example.com': [{ address: '10.0.0.5', family: 4 }],
      }),
      send,
    })

    const redirect = await fetch('https://mcp.example.com/mcp', { redirect: 'follow' })

    expect(redirect.status).toBe(307)
    expect(redirect.headers.get('location')).toBe('https://internal.example.com/mcp')
    expect(send).toHaveBeenCalledTimes(1)

    // The SDK follows a hop by calling the fetch again, which checks it as it checked the first
    await expect(fetch(redirect.headers.get('location')!)).rejects.toBeInstanceOf(OutboundRefusal)
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('gives up past its deadline while the server is silent', async () => {
    const silent = mock(
      (_url: URL, _address: ResolvedAddress, _headers: Record<string, string>, signal: AbortSignal) =>
        new Promise<OutboundStream>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason))
        }),
    )
    const fetch = createGuardedFetch({ maxBytes: 1000, timeoutMs: 20, resolve, send: silent })

    await expect(fetch('https://mcp.example.com/mcp')).rejects.toThrow()
  })

  test('gives up once the operation it serves aborts', async () => {
    const controller = new AbortController()
    const silent = mock(
      (_url: URL, _address: ResolvedAddress, _headers: Record<string, string>, signal: AbortSignal) =>
        new Promise<OutboundStream>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason))
        }),
    )
    const fetch = createGuardedFetch({
      maxBytes: 1000,
      timeoutMs: 10000,
      signal: controller.signal,
      resolve,
      send: silent,
    })
    const pending = fetch('https://mcp.example.com/mcp')

    controller.abort(new Error('The operation ended'))

    await expect(pending).rejects.toThrow('The operation ended')
  })

  test('fails to read a body past its cap', async () => {
    const { send } = createServer(respond(200, {}, ['a'.repeat(600), 'b'.repeat(600)]))
    const fetch = createGuardedFetch({ ...OPTIONS, resolve, send })

    const response = await fetch('https://mcp.example.com/mcp')

    await expect(response.text()).rejects.toBeInstanceOf(OutboundRefusal)
  })

  test('streams a body as it arrives, as a server sends its events', async () => {
    let release = () => {}
    const second = new Promise<void>(resolve => {
      release = resolve
    })
    const send = mock(async (): Promise<OutboundStream> => ({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: (async function* () {
        yield new TextEncoder().encode('event: message\ndata: 1\n\n')
        await second
        yield new TextEncoder().encode('event: message\ndata: 2\n\n')
      })(),
    }))
    const fetch = createGuardedFetch({ ...OPTIONS, resolve, send })
    const reader = (await fetch('https://mcp.example.com/mcp')).body!.getReader()

    expect(new TextDecoder().decode((await reader.read()).value)).toContain('data: 1')

    release()

    expect(new TextDecoder().decode((await reader.read()).value)).toContain('data: 2')
    expect((await reader.read()).done).toBe(true)
  })

  test('closes the connection when the body is cancelled', async () => {
    let isClosed = false
    const send = mock(async (): Promise<OutboundStream> => ({
      status: 200,
      headers: {},
      body: (async function* () {
        try {
          yield new TextEncoder().encode('first')
          await new Promise(() => {})
        } finally {
          isClosed = true
        }
      })(),
    }))
    const fetch = createGuardedFetch({ ...OPTIONS, resolve, send })
    const reader = (await fetch('https://mcp.example.com/mcp')).body!.getReader()

    await reader.read()
    await reader.cancel()

    expect(isClosed).toBe(true)
  })

  test('answers no body where a status has none', async () => {
    const { send } = createServer(respond(204, {}, ['ignored']), respond(202))
    const fetch = createGuardedFetch({ ...OPTIONS, resolve, send })

    expect((await fetch('https://mcp.example.com/mcp')).body).toBeNull()
    expect((await fetch('https://mcp.example.com/mcp')).status).toBe(202)
  })

  test('refuses a compressed body and a status no response has', async () => {
    const { send } = createServer(respond(200, { 'content-encoding': 'gzip' }, ['\u001f']), respond(101))
    const fetch = createGuardedFetch({ ...OPTIONS, resolve, send })

    await expect(fetch('https://mcp.example.com/mcp')).rejects.toBeInstanceOf(OutboundRefusal)
    await expect(fetch('https://mcp.example.com/mcp')).rejects.toBeInstanceOf(OutboundRefusal)
  })
})
