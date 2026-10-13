import type { IncomingHttpHeaders } from 'node:http'

import requestOutbound, {
  OutboundRefusal,
  type OutboundRefusalReason,
  type OutboundSend,
  type OutboundStream,
  type ResolvedAddress,
} from '~utils/requestOutbound'

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
  send?: OutboundSend
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

/*
  Fetches a web address somebody else gave, with a GET, through `requestOutbound`, the guard every
  request made on another's behalf goes through: http or https on its protocol's own port, every
  address its hostname resolves to on the public internet, the connection pinned to the one checked.
  A redirect is followed by hand, as many as `maxRedirects`, each checked the same way. The whole
  fetch has a deadline, resolutions included, and the body is read up to `maxBytes`, past which it
  is cut.

  It sends no cookie nor credential, and asks for an uncompressed body, so the byte count is the
  body's. A refused address throws an `OutboundRefusal`; a network failure, a timeout included,
  throws as Node throws it
*/
async function fetchOutbound(
  address: string,
  { maxBytes, timeoutMs, maxRedirects, headers = {}, resolve, send }: FetchOutboundOptions,
): Promise<OutboundResponse> {
  const signal = AbortSignal.timeout(timeoutMs)
  let url: string | URL = address

  for (let redirects = 0; ; redirects++) {
    const response = await requestOutbound(url, { headers, signal, resolve, send })
    const location = response.headers.location

    if (response.status >= 300 && response.status < 400 && location) {
      await drain(response.body)

      if (redirects >= maxRedirects) {
        throw new OutboundRefusal(`More than ${maxRedirects} redirects from ${response.url.origin}`, 'redirects')
      }

      url = new URL(location, response.url)

      continue
    }

    const { body, isTruncated } = await readBody(response.body, maxBytes)

    return { url: response.url.href, status: response.status, headers: response.headers, body, isTruncated }
  }
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

export { OutboundRefusal, type OutboundRefusalReason, type OutboundResponse, type OutboundStream, type ResolvedAddress }

export default fetchOutbound
