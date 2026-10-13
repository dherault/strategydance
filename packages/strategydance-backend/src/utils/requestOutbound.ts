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

/** What a request sends beside its headers */
type OutboundRequest = {
  method: string
  body?: Uint8Array
}

/** Sends a request to the one address checked, Node's HTTP unless a test stands in */
type OutboundSend = (
  url: URL,
  address: ResolvedAddress,
  headers: Record<string, string>,
  signal: AbortSignal,
  request: OutboundRequest,
) => Promise<OutboundStream>

type RequestOutboundOptions = {
  /** The protocols the address may name, http and https unless a caller narrows them */
  protocols?: readonly string[]
  method?: string
  headers?: Record<string, string>
  body?: Uint8Array
  /** Ends the request, its resolution included, once it aborts */
  signal: AbortSignal
  /** Every address a hostname resolves to, the system's resolver unless a test stands in */
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>
  send?: OutboundSend
}

/**
 * Why a request was refused: an address that is not a web one, or in a protocol the caller does not
 * allow, a port or credentials it should not carry, a hostname that is not public or resolves to an
 * address that is not, more redirects than allowed, or an answer the caller will not hand on
 */
type OutboundRefusalReason = 'address' | 'port' | 'credentials' | 'privateAddress' | 'redirects' | 'response'

/** A request this server will not make: to an address that is not public, a port or a protocol it does not speak */
class OutboundRefusal extends Error {
  name = 'OutboundRefusal'
  reason: OutboundRefusalReason

  constructor(message: string, reason: OutboundRefusalReason) {
    super(message)
    this.reason = reason
  }
}

const PORTS: Record<string, string> = { 'http:': '80', 'https:': '443' }

const WEB_PROTOCOLS = ['http:', 'https:']

/*
  Names that reach this server's own network rather than the internet, refused before they are
  resolved: the loopback names, mDNS's, home networks' and `.internal`, under which Google Cloud
  serves the metadata server (`metadata.google.internal`), which hands out the service's tokens. A
  name of one label is refused too, since the resolver completes it with the network's own search
  domains, as `metadata` reaches that server on Google Cloud. The addresses are checked anyway; this
  refuses what the address check would only catch once the name resolved
*/
const PRIVATE_NAME_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa']

/*
  One request to a web address somebody else gave, from a server that also reaches its own
  database, its metadata server and whatever else sits on its network: the hop every request made
  on another's behalf goes through, `fetchOutbound` and the integrations' guarded fetch alike.

  The address is one of the protocols allowed, on its protocol's own port, without credentials, and
  its hostname no private name. It is resolved, every address it resolves to has to be on the public
  internet (`isGloballyRoutableAddress`), and the connection goes to the one checked rather than to
  whatever a second resolution would answer, so a name that answers a public address to the check
  and a private one to the connection reaches nothing. A redirect is answered as it came, never
  followed: whoever follows it sends it through here again.

  It asks for an uncompressed body, so a byte count is the body's. A refused address throws an
  `OutboundRefusal` naming the origin alone, since a path or a query can carry a secret; a network
  failure, an abort included, throws as Node throws it
*/
async function requestOutbound(
  address: string | URL,
  {
    protocols = WEB_PROTOCOLS,
    method = 'GET',
    headers = {},
    body,
    signal,
    resolve = resolveHostname,
    send = sendRequest,
  }: RequestOutboundOptions,
) {
  const url = parseAddress(address, protocols)
  const target = await resolveChecked(url, resolve, signal)
  const requestHeaders: Record<string, string> = { ...headers, 'accept-encoding': 'identity' }

  if (body) requestHeaders['content-length'] = String(body.byteLength)

  const response = await send(url, target, requestHeaders, signal, { method, body })

  return { ...response, url }
}

// The address as a URL this server will request: one of the protocols allowed, on its port, with a public name
function parseAddress(address: string | URL, protocols: readonly string[]) {
  let url: URL

  try {
    url = new URL(address)
  } catch {
    throw new OutboundRefusal('Not a web address', 'address')
  }

  if (!protocols.includes(url.protocol))
    throw new OutboundRefusal(`Not a protocol this server speaks: ${url.protocol}`, 'address')
  if (url.port && url.port !== PORTS[url.protocol]) throw new OutboundRefusal(`Not a web port: ${url.origin}`, 'port')
  if (url.username || url.password)
    throw new OutboundRefusal(`A web address with credentials: ${url.origin}`, 'credentials')
  if (isPrivateName(url.hostname)) throw new OutboundRefusal(`Not a public name: ${url.origin}`, 'privateAddress')

  return url
}

// Whether a hostname that is no IP address names something on this server's own network
function isPrivateName(hostname: string) {
  const name = toBareHostname(hostname).toLowerCase().replace(/\.+$/, '')

  if (isIP(name)) return false

  return !name.includes('.') || name === 'localhost' || PRIVATE_NAME_SUFFIXES.some(suffix => name.endsWith(suffix))
}

// The URL parser writes an IPv6 hostname in brackets, which neither the resolver nor the checks read
function toBareHostname(hostname: string) {
  return hostname.replace(/^\[(.*)\]$/, '$1')
}

// The address to connect to, once every address the hostname resolves to is public, within the deadline
async function resolveChecked(url: URL, resolve: NonNullable<RequestOutboundOptions['resolve']>, signal: AbortSignal) {
  const hostname = toBareHostname(url.hostname)
  const family = isIP(hostname)
  const addresses = family ? [{ address: hostname, family }] : await untilAborted(resolve(hostname), signal)

  if (!addresses.length || !addresses.every(({ address }) => isGloballyRoutableAddress(address))) {
    throw new OutboundRefusal(`Not a public address: ${url.origin}`, 'privateAddress')
  }

  return addresses[0]
}

// What a promise settles to, or the signal's reason once it aborts first, a stalled resolver's say
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(signal.reason)

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason)

    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

async function resolveHostname(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true })
}

// A request to one address checked: the lookup answers it whatever it is asked, and TLS still checks the hostname
function sendRequest(
  url: URL,
  address: ResolvedAddress,
  headers: Record<string, string>,
  signal: AbortSignal,
  { method, body }: OutboundRequest,
) {
  const transport = url.protocol === 'https:' ? https : http

  return new Promise<OutboundStream>((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method,
        headers,
        signal,
        lookup: (_hostname, options, callback) => {
          if (options.all) (callback as (error: null, addresses: ResolvedAddress[]) => void)(null, [address])
          else callback(null, address.address, address.family)
        },
      },
      response => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: response }),
    )

    /*
      An abort destroys the request's socket with the abort's error too, which the request
      reports itself: under Bun nothing else listens on a TLS socket, and a stream let go of, as the
      MCP client lets go of its server events when it closes, took the process down with an error
      nobody heard
    */
    request.on('socket', socket => socket.on('error', () => {}))
    request.on('error', reject)
    request.end(body)
  })
}

export {
  OutboundRefusal,
  type OutboundRefusalReason,
  type OutboundRequest,
  type OutboundSend,
  type OutboundStream,
  type RequestOutboundOptions,
  type ResolvedAddress,
}

export default requestOutbound
