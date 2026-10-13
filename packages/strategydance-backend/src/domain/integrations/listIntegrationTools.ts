import {
  Client,
  type FetchLike,
  SdkHttpError,
  StreamableHTTPClientTransport,
  UnsupportedProtocolVersionError,
  type VersionNegotiationOptions,
} from '@modelcontextprotocol/client'
import { MAX_INTEGRATION_TOOLS } from 'strategydance-core'
import { IntegrationApiKeyScheme, IntegrationError } from 'strategydance-database/backend'

import { INTEGRATION_REQUEST_TIMEOUT_MS, MODULE_PROTOCOL_VERSION } from '~constants'

import IntegrationFailure from '~domain/integrations/IntegrationFailure'

type IntegrationCredential = {
  key: string
  scheme: IntegrationApiKeyScheme
  // The header a `HEADER` key is sent in
  header: string | null
}

type ListIntegrationToolsOptions = {
  url: string
  // The organization's key, for a key-based server; none for one taking no authentication
  credential: IntegrationCredential | null
  fetch: FetchLike
  signal: AbortSignal
}

// How many pages of tools a server may answer in, each up to the guard's cap
const MAX_TOOL_PAGES = 8

/*
  The tools an organization's MCP server lists, through the MCP SDK's client on the guarded fetch: a
  2025 revision's handshake first, as every remote server speaks today, and the 2026-07-28 revision
  pinned when the server answers that it speaks only that one. A key goes as a bearer token through
  the transport's own authentication, or alone in the header named, and nowhere else: the SDK sends
  it to the server's origin alone, and the guarded fetch follows no redirect. The session, if the
  server kept one, is ended before the client closes. A server listing more than
  `MAX_INTEGRATION_TOOLS` tools is refused rather than kept in part
*/
async function listIntegrationTools(options: ListIntegrationToolsOptions) {
  let tools

  try {
    tools = await listWith(options)
  } catch (error) {
    if (!isModernOnly(error)) throw error

    tools = await listWith(options, { mode: { pin: MODULE_PROTOCOL_VERSION } })
  }

  if (tools.length > MAX_INTEGRATION_TOOLS) {
    throw new IntegrationFailure(
      IntegrationError.TOO_MANY_TOOLS,
      `${new URL(options.url).origin} listed ${tools.length} tools`,
    )
  }

  return tools
}

async function listWith(
  { url, credential, fetch, signal }: ListIntegrationToolsOptions,
  versionNegotiation?: VersionNegotiationOptions,
) {
  const client = new Client(
    { name: 'strategydance', version: '1.0.0' },
    { listMaxPages: MAX_TOOL_PAGES, ...(versionNegotiation && { versionNegotiation }) },
  )
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    fetch,
    ...(credential?.scheme === IntegrationApiKeyScheme.BEARER && {
      authProvider: { token: async () => credential.key },
    }),
    ...(credential?.scheme === IntegrationApiKeyScheme.HEADER
      && credential.header && { requestInit: { headers: { [credential.header]: credential.key } } }),
    // A stream cut by the guard's deadline is not opened again behind the request that listed
    reconnectionOptions: {
      maxRetries: 0,
      initialReconnectionDelay: 1000,
      maxReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1,
    },
  })
  const requestOptions = { signal, timeout: INTEGRATION_REQUEST_TIMEOUT_MS }

  try {
    await client.connect(transport, requestOptions)

    const { tools } = await client.listTools(undefined, requestOptions)

    return tools
  } finally {
    await transport.terminateSession().catch(() => {})
    await client.close().catch(() => {})
  }
}

/*
  Whether a server answered the 2025 handshake that it speaks only the 2026-07-28 revision: the
  SDK's error for it, or, as the handshake reports it, an HTTP 400 whose body is that JSON-RPC
  error, -32022
*/
function isModernOnly(error: unknown) {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if (UnsupportedProtocolVersionError.isInstance(cause)) return true
    if (SdkHttpError.isInstance(cause) && cause.status === 400 && readJsonRpcErrorCode(cause.data.text) === -32022) {
      return true
    }
  }

  return false
}

function readJsonRpcErrorCode(text: unknown) {
  if (typeof text !== 'string') return null

  try {
    const answer: unknown = JSON.parse(text)

    if (typeof answer !== 'object' || answer === null || !('error' in answer)) return null

    const { error } = answer

    return typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  } catch {
    return null
  }
}

export { type IntegrationCredential }

export default listIntegrationTools
