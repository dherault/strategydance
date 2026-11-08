import type { McpServer } from '@modelcontextprotocol/server'
import { MODULES, type ModuleName, SERVED_MODULES } from 'strategydance-core'

import type { ModuleAccess } from '~types'

import MODULE_REGISTRATIONS from '~modules/moduleRegistrations'

// Strategy Dance's agent with every scope, whose tools register as written: read for their names
// alone, never called
const NAMING_ACCESS: ModuleAccess = {
  kind: 'agent',
  userId: 'naming',
  scopes: MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write]),
  idempotencyScope: 'naming',
  organization: { organizationId: 'naming', membershipCreatedAt: 'naming' },
}

let toolModules: ReadonlyMap<string, ModuleName> | undefined

/*
  The served module a tool's name belongs to, or nothing for a name no served module registers,
  which the SDK answers as it answers any tool it does not list. Read once, by registering each
  served module on a stand-in that records the names `registerTool` is given, since a tool's name
  is written in its own file alone, and a name is unique across the modules
*/
function findToolModule(toolName: string): ModuleName | undefined {
  if (!toolModules) {
    const names = new Map<string, ModuleName>()

    for (const { name } of SERVED_MODULES) {
      const recorder = { registerTool: (tool: string) => names.set(tool, name) }

      MODULE_REGISTRATIONS[name](recorder as unknown as McpServer, NAMING_ACCESS)
    }

    toolModules = names
  }

  return toolModules.get(toolName)
}

export default findToolModule
