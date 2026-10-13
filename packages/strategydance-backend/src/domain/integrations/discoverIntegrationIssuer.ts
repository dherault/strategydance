import {
  checkResourceAllowed,
  discoverAuthorizationServerMetadata,
  discoverOAuthProtectedResourceMetadata,
  extractWWWAuthenticateParams,
  type FetchLike,
  LATEST_PROTOCOL_VERSION,
} from '@modelcontextprotocol/client'
import { IntegrationError } from 'strategydance-database/backend'

import IntegrationFailure from '~domain/integrations/IntegrationFailure'

/*
  The issuer of the authorization server an OAuth MCP server names, as MCP's authorization asks a
  client to find it, every request through the guarded fetch.

  An unauthenticated request to the server first, which has to answer as an MCP server taking OAuth
  does, challenging it or answering it, and whose 401 names its protected resource metadata (RFC
  9728); that metadata, or the one at its well-known address, has to name the server's own address
  as its resource and an authorization server, whose metadata (RFC 8414) has to name that same
  server as its issuer. A server without protected resource metadata, every well-known address
  answering 404, has its authorization server at its own origin, as the 2025-03-26 revision had it:
  only then, never on another failure, since a passing outage read as another issuer would clear
  everything given for the one it has.

  The authorization server has to offer S256 and a way for Strategy Dance to register without a
  human, dynamic registration or client ID metadata documents, or no member could ever connect it
  (M28): refused otherwise, as a discovery that failed
*/
async function discoverIntegrationIssuer(url: string, fetch: FetchLike) {
  const origin = new URL(url).origin
  const fail = (reason: string) => new IntegrationFailure(IntegrationError.DISCOVERY_FAILED, `${origin}: ${reason}`)
  const probe = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'strategydance', version: '1.0.0' },
      },
    }),
  })

  if (probe.status >= 500) {
    await probe.body?.cancel()

    throw new IntegrationFailure(IntegrationError.UNREACHABLE, `${origin}: ${probe.status}`)
  }

  /*
    An MCP server taking OAuth challenges a request without a token with a bearer challenge, as RFC
    6750 says, or, when it lets `initialize` through anyway, answers it as MCP does. Some answer 401
    with no challenge at all, as Hunter's does: taken only when protected resource metadata names the
    address below, never on the origin's metadata alone. Anything else, a page, a 404 or another
    challenge, is no MCP server, whatever OAuth metadata its host publishes
  */
  const challenge = probe.headers.get('www-authenticate')
  const isUnchallenged = probe.status === 401 && challenge === null
  const isChallenged = probe.status === 401 && (isUnchallenged || /^bearer\b/i.test(challenge ?? ''))
  const isAnswered = !isChallenged && probe.ok && (await readsInitializeAnswer(probe))

  await probe.body?.cancel().catch(() => {})

  if (!isChallenged && !isAnswered) {
    throw new IntegrationFailure(IntegrationError.NOT_MCP_SERVER, `${origin}: ${probe.status}, no MCP answer`)
  }

  const { resourceMetadataUrl } = probe.status === 401 ? extractWWWAuthenticateParams(probe) : {}
  const statuses: number[] = []
  const recording: FetchLike = async (input, init) => {
    const response = await fetch(input, init)

    statuses.push(response.status)

    return response
  }
  let authorizationServerUrl: string

  try {
    const resource = await discoverOAuthProtectedResourceMetadata(url, { resourceMetadataUrl }, recording)

    if (!checkResourceAllowed({ requestedResource: url, configuredResource: resource.resource })) {
      throw fail('its protected resource metadata names another resource')
    }

    const [first] = resource.authorization_servers ?? []

    if (!first) throw fail('its protected resource metadata names no authorization server')

    authorizationServerUrl = first
  } catch (error) {
    const isMissing = statuses.length > 0 && statuses.every(status => status === 404)

    if (error instanceof IntegrationFailure || !isMissing) throw error
    if (isUnchallenged) throw fail('it answers 401 without a challenge and names no resource metadata')

    authorizationServerUrl = new URL('/', url).href
  }

  const metadata = await discoverAuthorizationServerMetadata(authorizationServerUrl, { fetchFn: fetch })

  if (!metadata) throw fail('its authorization server publishes no metadata')
  if (!metadata.code_challenge_methods_supported?.includes('S256'))
    throw fail('its authorization server offers no S256')

  const isRegistrable = Boolean(metadata.registration_endpoint) || readsClientMetadataDocuments(metadata)

  if (!isRegistrable) throw fail('its authorization server offers no way to register')

  return metadata.issuer
}

// How much of an answer to `initialize` is read for its result, which a server sends first
const MAX_INITIALIZE_ANSWER_BYTES = 64 * 1024

/*
  Whether an answer is MCP's to `initialize`: a JSON-RPC result naming a protocol version, as JSON
  or as the first of the server's events, read only as far as it, since a stream of events can stay
  open after it
*/
async function readsInitializeAnswer(response: Response) {
  const reader = response.body?.getReader()

  if (!reader) return false

  const decoder = new TextDecoder()
  const isEventStream = (response.headers.get('content-type') ?? '').includes('text/event-stream')
  let text = ''

  while (text.length < MAX_INITIALIZE_ANSWER_BYTES) {
    const { value, done } = await reader.read()

    if (value) text += decoder.decode(value, { stream: true })

    const messages = isEventStream
      ? text
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice('data:'.length).trim())
      : done
        ? [text]
        : []

    if (messages.some(isInitializeResult)) return true
    if (done) return false
  }

  return false
}

function isInitializeResult(message: string) {
  try {
    const parsed: unknown = JSON.parse(message)

    return (
      typeof parsed === 'object'
      && parsed !== null
      && 'result' in parsed
      && typeof parsed.result === 'object'
      && parsed.result !== null
      && 'protocolVersion' in parsed.result
      && typeof parsed.result.protocolVersion === 'string'
    )
  } catch {
    return false
  }
}

function readsClientMetadataDocuments(metadata: object) {
  return 'client_id_metadata_document_supported' in metadata && metadata.client_id_metadata_document_supported === true
}

export default discoverIntegrationIssuer
