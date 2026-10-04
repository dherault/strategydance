import { lookup } from 'node:dns/promises'
import http, { type IncomingHttpHeaders } from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

import isGloballyRoutableAddress from '~utils/isGloballyRoutableAddress'

/** An address a hostname resolved to, as `dns.lookup` writes one */
type ResolvedAddress = { address: string; family: number }

/** A response's head, and its body as it arrives */
type OutboundStream = {
  status: number
  headers: IncomingHttpHeaders
  body: AsyncIterable<Uint8Array>
}

type FetchOutboundOptions = {
  /** How much of the body to read, past which it is cut and said to be */
  maxBytes: number
  /** How long the whole fetch may take, redirects included */
  timeoutMs: number
  /** How many redirects to follow, each checked as the first address was */
  maxRedirects: number
  headers?: Record<string, string>
  /** Every address a hostname resolves to, the system's resolver unless a test stands in */
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>
  /** Sends the request to the one address checked, Node's HTTP unless a test stands in */
  send?: (
    url: URL,
    address: ResolvedAddress,
    headers: Record<string, string>,
    signal: AbortSignal,
  ) => Promise<OutboundStream>
}

type OutboundResponse = {
  /** The address the body came from, after the redirects */
  url: string
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
  /** Whether the body went past `maxBytes` and was cut */
  isTruncated: boolean
}

/** A request this server will not make: to an address that is not public, a port or a protocol it does not speak */
class OutboundRefusal extends Error {
  name = 'OutboundRefusal'
}

const PORTS: Record<string, string> = { 'http:': '80', 'https:': '443' }

/*
  Fetches a web address somebody else gave, with a GET, from a server that also reaches its own
  database, its metadata server and whatever else sits on its network: the guard every request
  made on another's behalf goes through.

  The address is http or https, on its protocol's own port. Its hostname is resolved, every address
  it resolves to has to be on the public internet (`isGloballyRoutableAddress`), and the connection
  goes to the one checked rather than to whatever a second resolution would answer, so a name that
  answers a public address to the check and a private one to the connection reaches nothing. A
  redirect is followed by hand, as many as `maxRedirects`, each checked the same way. The whole
  fetch has a deadline, and the body is read up to `maxBytes`, past which it is cut.

  It sends no cookie nor credential, and asks for an uncompressed body, so the byte count is the
  body's. A refused address throws an `OutboundRefusal`; a network failure, a timeout included,
  throws as Node throws it
*/
async function fetchOutbound(
  address: string,
  {
    maxBytes,
    timeoutMs,
    maxRedirects,
    headers = {},
    resolve = resolveHostname,
    send = sendRequest,
  }: FetchOutboundOptions,
): Promise<OutboundResponse> {
  const signal = AbortSignal.timeout(timeoutMs)
  const requestHeaders = { ...headers, 'accept-encoding': 'identity' }
  let url = parseAddress(address)

  for (let redirects = 0; ; redirects++) {
    const target = await resolveChecked(url, resolve)
    const response = await send(url, target, requestHeaders, signal)
    const location = response.headers.location

    if (response.status >= 300 && response.status < 400 && location) {
      await drain(response.body)

      if (redirects >= maxRedirects) throw new OutboundRefusal(`More than ${maxRedirects} redirects from ${address}`)

      url = parseAddress(new URL(location, url).href)

      continue
    }

    const { body, isTruncated } = await readBody(response.body, maxBytes)

    return { url: url.href, status: response.status, headers: response.headers, body, isTruncated }
  }
}

// The address as a URL this server will request: http or https, on its protocol's port
function parseAddress(address: string) {
  let url: URL

  try {
    url = new URL(address)
  } catch {
    throw new OutboundRefusal(`Not a web address: ${address}`)
  }

  if (!(url.protocol in PORTS)) throw new OutboundRefusal(`Not a web address: ${address}`)
  if (url.port && url.port !== PORTS[url.protocol]) throw new OutboundRefusal(`Not a web port: ${address}`)
  if (url.username || url.password) throw new OutboundRefusal(`A web address with credentials: ${address}`)

  return url
}

// The address to connect to, once every address the hostname resolves to is public
async function resolveChecked(url: URL, resolve: NonNullable<FetchOutboundOptions['resolve']>) {
  // The URL parser writes an IPv6 hostname in brackets, which neither the resolver nor the check reads
  const hostname = url.hostname.replace(/^\[(.*)\]$/, '$1')
  const family = isIP(hostname)
  const addresses = family ? [{ address: hostname, family }] : await resolve(hostname)

  if (!addresses.length || !addresses.every(({ address }) => isGloballyRoutableAddress(address))) {
    throw new OutboundRefusal(`Not a public address: ${url.hostname}`)
  }

  return addresses[0]
}

async function resolveHostname(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true })
}

// A GET to one address checked: the lookup answers it whatever it is asked, and TLS still checks the hostname
function sendRequest(url: URL, address: ResolvedAddress, headers: Record<string, string>, signal: AbortSignal) {
  const transport = url.protocol === 'https:' ? https : http

  return new Promise<OutboundStream>((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: 'GET',
        headers,
        signal,
        lookup: (_hostname, options, callback) => {
          if (options.all) (callback as (error: null, addresses: ResolvedAddress[]) => void)(null, [address])
          else callback(null, address.address, address.family)
        },
      },
      response => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: response }),
    )

    request.on('error', reject)
    request.end()
  })
}

async function drain(body: AsyncIterable<Uint8Array>) {
  // Leaving the loop at once closes the stream, rather than reading a redirect's body
  for await (const _chunk of body) break
}

async function readBody(body: AsyncIterable<Uint8Array>, maxBytes: number) {
  const chunks: Uint8Array[] = []
  let size = 0

  for await (const chunk of body) {
    if (size + chunk.length > maxBytes) {
      chunks.push(chunk.subarray(0, maxBytes - size))

      return { body: Buffer.concat(chunks), isTruncated: true }
    }

    chunks.push(chunk)
    size += chunk.length
  }

  return { body: Buffer.concat(chunks), isTruncated: false }
}

export { OutboundRefusal, type OutboundResponse, type OutboundStream, type ResolvedAddress }

export default fetchOutbound
