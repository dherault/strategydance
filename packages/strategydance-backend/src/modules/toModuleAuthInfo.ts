import type { AuthInfo } from '@modelcontextprotocol/server'

import type { ModuleCaller } from '~types'

// What stands in for a token where nothing presents one: Strategy Dance's agent, whose caller the
// worker verified from its run
const AGENT_TOKEN = 'strategydance-worker'
const AGENT_CLIENT_ID = 'strategydance-agent'

/*
  A verified caller as the SDK carries it to a module's server, in the `extra` of its `AuthInfo`,
  which requires a token, a client and scopes beside it. Fixed values name the worker for Strategy
  Dance's agent; an external agent's come from its access token's row, its expiry and resource
  included, which the SDK's bearer check requires
*/
function toModuleAuthInfo(
  caller: ModuleCaller,
  fields: Partial<Pick<AuthInfo, 'token' | 'clientId' | 'expiresAt' | 'resource'>> = {},
): AuthInfo {
  return { token: AGENT_TOKEN, clientId: AGENT_CLIENT_ID, scopes: [...caller.scopes], ...fields, extra: { caller } }
}

export default toModuleAuthInfo
