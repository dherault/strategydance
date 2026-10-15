import { createMcpHandler } from '@modelcontextprotocol/server'
import type { ModuleName } from 'strategydance-core'

import MODULE_SERVERS from '~modules/moduleServers'
import readModuleCaller from '~modules/readModuleCaller'

/*
  A module's handler, which builds a fresh server for each request from the caller its `authInfo`
  carries, as `toModuleAuthInfo` wrote it, and answers in JSON, stateless as the 2026-07-28 revision
  is, serving the 2025 revisions' clients statelessly too. Strategy Dance's agent and the public
  endpoint go through this one handler, so both get the same tools and checks. It verifies no token
  itself: whatever calls `fetch` has verified the caller.

  It keeps the SDK's `auto` response mode, which answers JSON while a tool emits nothing before its
  result, as none does, and streams if one ever does. `json` would drop such a message, and makes the
  SDK warn so on the console for each module at launch
*/
function createModuleHandler(name: ModuleName) {
  return createMcpHandler(({ authInfo }) => MODULE_SERVERS[name](readModuleCaller(authInfo)), {
    legacy: 'stateless',
  })
}

export default createModuleHandler
