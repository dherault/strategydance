import { createMcpHandler } from '@modelcontextprotocol/server'
import type { ModuleName } from 'strategydance-core'

import createModulesServer from '~modules/createModulesServer'
import readModuleAccess from '~modules/readModuleAccess'

/*
  The handler of the modules its caller names, which builds a fresh server of them for each request
  from the access its `authInfo` carries, as `toModuleAuthInfo` wrote it, and answers in JSON,
  stateless as the 2026-07-28 revision is, serving the 2025 revisions' clients statelessly too.
  Strategy Dance's agent and the public endpoints go through it, so both get the same tools and
  checks. Building every module given, rather than the one a call names, costs a fraction of a
  millisecond. It verifies no token itself: whatever calls `fetch` has verified the access.

  It keeps the SDK's `auto` response mode, which answers JSON while a tool emits nothing before its
  result, as none does, and streams if one ever does. `json` would drop such a message, and makes the
  SDK warn so on the console for each module at launch
*/
function createModuleHandler(modules: readonly ModuleName[]) {
  return createMcpHandler(({ authInfo }) => createModulesServer(readModuleAccess(authInfo), modules), {
    legacy: 'stateless',
  })
}

export default createModuleHandler
