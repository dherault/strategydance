import {
  INTEGRATION_OPERATION_TIMEOUT_MS,
  INTEGRATION_REQUEST_TIMEOUT_MS,
  MAX_INTEGRATION_RESPONSE_BYTES,
} from '~constants'

import createGuardedFetch from '~utils/createGuardedFetch'
import type { OutboundSend, ResolvedAddress } from '~utils/requestOutbound'

// The network the guard reaches, the system's unless a test stands in
type IntegrationNetwork = {
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>
  send?: OutboundSend
}

/*
  The `fetch` every request to an organization's MCP server, or to the authorization server it names,
  goes through: the guarded fetch, each request within 15 seconds and 4 MiB, all of them ended by the
  operation's signal, 30 seconds unless the caller gives another. A test that reaches a fake server
  through the routes replaces this module, as nothing else of the network is theirs to give
*/
function createIntegrationFetch(
  { resolve, send }: IntegrationNetwork = {},
  signal: AbortSignal = AbortSignal.timeout(INTEGRATION_OPERATION_TIMEOUT_MS),
) {
  return createGuardedFetch({
    maxBytes: MAX_INTEGRATION_RESPONSE_BYTES,
    timeoutMs: INTEGRATION_REQUEST_TIMEOUT_MS,
    signal,
    resolve,
    send,
  })
}

export { type IntegrationNetwork }

export default createIntegrationFetch
