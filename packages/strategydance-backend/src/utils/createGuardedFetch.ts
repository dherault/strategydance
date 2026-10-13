import type { IncomingHttpHeaders } from 'node:http'

import requestOutbound, { OutboundRefusal, type OutboundSend, type ResolvedAddress } from '~utils/requestOutbound'

type GuardedFetchOptions = {
  /** How much of one response's body may be read, past which reading it fails */
  maxBytes: number
  /** How long one request may take, its body read included */
  timeoutMs: number
  /** Ends every request it makes once it aborts: the deadline of the operation they serve */
  signal?: AbortSignal
  /** Every address a hostname resolves to, the system's resolver unless a test stands in */
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>
  /** Sends a request to the one address checked, Node's HTTP unless a test stands in */
  send?: OutboundSend
}

/*
  A response the guard will not hand on: a status no response has, a body compressed though none was
  asked for, or one past its cap, which `isTooLarge` says. Set apart from a refused address, since
  the server was reached
*/
class OutboundResponseRefusal extends OutboundRefusal {
  name = 'OutboundResponseRefusal'

  constructor(
    message: string,
    readonly isTooLarge = false,
  ) {
    super(message, 'response')
  }
}

// What a server on the other end reads Strategy Dance as, since some refuse a request naming nobody
const USER_AGENT = 'StrategyDance/1.0 (+https://strategydance.com)'

// The statuses whose response has no body, whatever the server sends
const STATUSES_WITHOUT_BODY = new Set([204, 205, 304])

/*
  A `fetch` for the MCP SDK's client, every request of which goes through `requestOutbound`, the
  guard every request made on another's behalf goes through, since an administrator types the
  address of an organization's MCP server: https alone, on its own port, every address its hostname
  resolves to on the public internet, and the connection pinned to the one checked.

  A redirect is answered as it came, never followed, whatever the request asks: the SDK follows a
  same-origin one itself, through this fetch again, so each hop is checked, and refuses one to
  another origin, so a key or a token never leaves the server it was given for.

  Each request has its own deadline, merged with the caller's signal and the operation's, and the
  body streams, as a server's events do, up to `maxBytes`, past which it fails. A body the server
  compressed is refused, since the count would not be its size: the guard asks for none
*/
function createGuardedFetch({ maxBytes, timeoutMs, signal, resolve, send }: GuardedFetchOptions) {
  return async (input: string | URL, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase()
    const headers = new Headers(init.headers)
    const body = await readRequestBody(init.body, headers)

    if (!headers.has('user-agent')) headers.set('user-agent', USER_AGENT)

    const requestSignal = AbortSignal.any(
      [init.signal, signal, AbortSignal.timeout(timeoutMs)].filter(item => item instanceof AbortSignal),
    )
    const response = await requestOutbound(input, {
      protocols: ['https:'],
      method,
      headers: Object.fromEntries(headers),
      body,
      signal: requestSignal,
      resolve,
      send,
    })
    const iterator = response.body[Symbol.asyncIterator]()

    if (response.status < 200 || response.status > 599) {
      await iterator.return?.()

      throw new OutboundResponseRefusal(`Not a status a response has: ${response.status} from ${response.url.origin}`)
    }

    const encoding = readHeader(response.headers, 'content-encoding')

    if (encoding && encoding.toLowerCase() !== 'identity') {
      await iterator.return?.()

      throw new OutboundResponseRefusal(`A compressed body, which was not asked for, from ${response.url.origin}`)
    }

    const hasBody = method !== 'HEAD' && !STATUSES_WITHOUT_BODY.has(response.status)

    if (!hasBody) await iterator.return?.()

    return new Response(hasBody ? createBodyStream(iterator, maxBytes, response.url.origin) : null, {
      status: response.status,
      headers: toHeaders(response.headers),
    })
  }
}

// A request's body as bytes, the types the SDK sends: JSON text, a form, or bytes
async function readRequestBody(body: RequestInit['body'], headers: Headers) {
  if (body === undefined || body === null) return undefined
  if (typeof body === 'string') return new TextEncoder().encode(body)

  if (body instanceof URLSearchParams) {
    if (!headers.has('content-type')) headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')

    return new TextEncoder().encode(body.toString())
  }

  if (body instanceof ArrayBuffer) return new Uint8Array(body)
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer())

  throw new TypeError('A request body the guarded fetch does not send')
}

// The body as it arrives, failing once it passes `maxBytes`, and closing the connection when cancelled
function createBodyStream(iterator: AsyncIterator<Uint8Array>, maxBytes: number, origin: string) {
  let size = 0

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next()

        if (done) {
          controller.close()

          return
        }

        size += value.byteLength

        if (size > maxBytes) {
          await iterator.return?.()
          controller.error(new OutboundResponseRefusal(`A response past ${maxBytes} bytes from ${origin}`, true))

          return
        }

        controller.enqueue(value)
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })
}

function readHeader(headers: IncomingHttpHeaders, name: string) {
  const value = headers[name]

  return Array.isArray(value) ? value.join(', ') : value
}

function toHeaders(incoming: IncomingHttpHeaders) {
  const headers = new Headers()

  for (const [name, value] of Object.entries(incoming)) {
    if (value === undefined) continue

    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item)
  }

  return headers
}

export { OutboundResponseRefusal }

export default createGuardedFetch
