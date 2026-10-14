import {
  Client,
  type FetchLike,
  SdkHttpError,
  StreamableHTTPClientTransport,
  UnsupportedProtocolVersionError,
  type VersionNegotiationOptions,
} from '@modelcontextprotocol/client'
import { IntegrationApiKeyScheme } from 'strategydance-database/backend'

import { INTEGRATION_REQUEST_TIMEOUT_MS, MODULE_PROTOCOL_VERSION } from '~constants'

type IntegrationCredential = {
  key: string
  scheme: IntegrationApiKeyScheme
  // The header a `HEADER` key is sent in
  header: string | null
}

type IntegrationClientOptions = {
  url: string
  // The organization's key or a member's token, for a server taking one; none for one taking no
  // authentication
  credential: IntegrationCredential | null
  fetch: FetchLike
  signal: AbortSignal
}

// How many pages of tools a server may answer in, each up to the guard's cap
const MAX_TOOL_PAGES = 8

/*
  A client connected to an organization's MCP server, through the MCP SDK's client on the guarded
  fetch: a 2025 revision's handshake first, as every remote server speaks today, and the 2026-07-28
  revision pinned when the server answers that it speaks only that one. Only the handshake is ever
  made twice: what follows it goes once, so a call is never sent again behind the caller's back.

  A key goes as a bearer token through the transport's own authentication, or alone in the header
  named, and nowhere else: the SDK sends it to the server's origin alone, and the guarded fetch
  follows no redirect. `close` ends the session, if the server kept one, then the client, and is
  called whatever the requests came to
*/
async function connectIntegrationClient(options: IntegrationClientOptions) {
  try {
    return await connectWith(options)
  } catch (error) {
    if (!isModernOnly(error)) throw error

    return connectWith(options, { mode: { pin: MODULE_PROTOCOL_VERSION } })
  }
}

async function connectWith(
  { url, credential, fetch, signal }: IntegrationClientOptions,
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
    // A stream cut by the guard's deadline is not opened again behind the request it answered
    reconnectionOptions: {
      maxRetries: 0,
      initialReconnectionDelay: 1000,
      maxReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1,
    },
  })
  const requestOptions = { signal, timeout: INTEGRATION_REQUEST_TIMEOUT_MS }
  const close = async () => {
    await transport.terminateSession().catch(() => {})
    await client.close().catch(() => {})
  }

  try {
    await client.connect(transport, requestOptions)
  } catch (error) {
    await close()

    throw error
  }

  return { client, requestOptions, close }
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

export { type IntegrationClientOptions, type IntegrationCredential }

export default connectIntegrationClient
