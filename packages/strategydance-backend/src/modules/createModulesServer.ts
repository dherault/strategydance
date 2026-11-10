import { McpServer } from '@modelcontextprotocol/server'
import { MODULES, MODULES_ADDRESS, type ModuleName } from 'strategydance-core'

import type { ModuleAccess } from '~types'

import MODULE_REGISTRATIONS from '~modules/moduleRegistrations'
import toModuleInstructions from '~modules/toModuleInstructions'

/*
  The MCP server of the modules its caller names, built for one access, whose caller every tool acts
  as. Each module given whose read scope the access holds registers its tools, in `MODULES`' order
  whatever the order given, so `tools/list` answers them module by module, and one the access cannot
  read lists nothing. A tool's name is unique across the modules, so they share one server.

  Given one module, the server goes by its module's name and title and says what its module's own
  server always said. Given several, it goes by the one address's, `strategydance`, "Strategy
  Dance", and its instructions say what Strategy Dance is once, then what each module it lists
  holds, and last the modules given that it does not list, which the member could allow. The
  caller names the modules, never the access's kind: Strategy Dance's worker every module its agent
  uses, a module's endpoint its module
*/
function createModulesServer(access: ModuleAccess, modules: readonly ModuleName[]) {
  const given = MODULES.filter(({ name }) => modules.includes(name))
  const listed = given.filter(({ scopes }) => access.scopes.includes(scopes.read))
  const alone = given.length === 1 ? given[0] : undefined
  const server = new McpServer(
    {
      ...(alone
        ? { name: `strategydance-${alone.name}`, title: alone.title }
        : { name: MODULES_ADDRESS.name, title: MODULES_ADDRESS.title }),
      version: '1.0.0',
    },
    {
      capabilities: { tools: {} },
      instructions: toModuleInstructions(
        alone
          ? { alone: alone.name }
          : {
              listed: listed.map(({ name }) => name),
              unheld: given.filter(module => !listed.includes(module)).map(({ name }) => name),
            },
        access,
      ),
    },
  )

  for (const { name } of listed) MODULE_REGISTRATIONS[name](server, access)

  return server
}

export default createModulesServer
