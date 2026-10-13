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

  An unauthenticated request to the server first, whose 401 names its protected resource metadata
  (RFC 9728); that metadata, or the one at its well-known address, has to name the server's own
  address as its resource and an authorization server, whose metadata (RFC 8414) has to name that
  same server as its issuer. A server without protected resource metadata, every well-known address
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

  await probe.body?.cancel()

  if (probe.status === 404)
    throw new IntegrationFailure(IntegrationError.NOT_MCP_SERVER, `${origin}: nothing at the address`)
  if (probe.status >= 500) throw new IntegrationFailure(IntegrationError.UNREACHABLE, `${origin}: ${probe.status}`)

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
    if (error instanceof IntegrationFailure || !statuses.length || statuses.some(status => status !== 404)) throw error

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

function readsClientMetadataDocuments(metadata: object) {
  return 'client_id_metadata_document_supported' in metadata && metadata.client_id_metadata_document_supported === true
}

export default discoverIntegrationIssuer
