import {
  MAX_INTEGRATION_API_KEY_HEADER_LENGTH,
  MAX_INTEGRATION_API_KEY_LENGTH,
  MAX_INTEGRATION_NAME_LENGTH,
  MAX_INTEGRATION_URL_LENGTH,
} from '../constants'

/*
  Headers an administrator may not name for a key: the ones the MCP client sets itself (the body's
  type and length, what it accepts, the protocol's own `Mcp-` family, a stream's resumption and a
  proof of possession), the ones HTTP/1 treats as the connection's rather than the request's, and
  the ones a proxy or a browser acts on (`Host`, `Cookie`, the `Proxy-` and `Sec-` families). Sent
  as a key, any of them would change what the request is, or be dropped on the way. `Authorization`
  is not among them: a server that takes a raw key, or another scheme than a bearer token, takes it
  there
*/
const RESERVED_HEADERS = new Set([
  'host',
  'content-length',
  'content-type',
  'content-encoding',
  'cookie',
  'connection',
  'transfer-encoding',
  'accept',
  'accept-encoding',
  'last-event-id',
  'dpop',
  'te',
  'upgrade',
  'keep-alive',
  'trailer',
  'expect',
])

const RESERVED_HEADER_PREFIXES = ['proxy-', 'sec-', 'mcp-']

// A header's name, a token as HTTP defines one
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

// Printable ASCII, spaces only between other characters, so a key is a header's value as it is
const API_KEY_PATTERN = /^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/

// Anything a name may not hold: a control character, a line or paragraph separator
// oxlint-disable-next-line no-control-regex
const NAME_FORBIDDEN_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/

// Whether a server's name is one an organization may give it: one line, not blank, not too long
export function isValidIntegrationName(name: string) {
  const trimmed = name.trim()

  return trimmed.length > 0 && trimmed.length <= MAX_INTEGRATION_NAME_LENGTH && !NAME_FORBIDDEN_PATTERN.test(trimmed)
}

/*
  A server's name as the uniqueness of names reads it: trimmed and in lowercase, so "Notion" and
  "notion " are one server's name, since the agent names a server by it
*/
export function normalizeIntegrationName(name: string) {
  return name.trim().toLowerCase()
}

/*
  A server's address as it is stored, or null when it is not one Strategy Dance reaches: https on
  its own port, with a host, no credentials and no fragment. Written back as the URL parser writes
  it, so the same address typed twice is one. Whether its host is on the public internet only the
  backend's outbound guard can tell, once it resolves it
*/
export function parseIntegrationUrl(value: string) {
  const trimmed = value.trim()

  if (trimmed.length > MAX_INTEGRATION_URL_LENGTH) return null

  let url: URL

  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  if (url.protocol !== 'https:' || !url.hostname || url.port || url.username || url.password || url.hash) return null

  return url.href
}

// Whether a key may be sent: printable ASCII, no line break nor NUL, which would split the header
export function isValidIntegrationApiKey(key: string) {
  return key.length <= MAX_INTEGRATION_API_KEY_LENGTH && API_KEY_PATTERN.test(key)
}

// Whether a header's name is one a key may be sent in: a token as HTTP defines one, and not reserved
export function isValidIntegrationApiKeyHeader(name: string) {
  return (
    name.length <= MAX_INTEGRATION_API_KEY_HEADER_LENGTH
    && HEADER_NAME_PATTERN.test(name)
    && !isReservedIntegrationHeader(name)
  )
}

// Whether a header is one the client sets itself, or one the connection or a proxy acts on
export function isReservedIntegrationHeader(name: string) {
  const lowercase = name.toLowerCase()

  return RESERVED_HEADERS.has(lowercase) || RESERVED_HEADER_PREFIXES.some(prefix => lowercase.startsWith(prefix))
}
