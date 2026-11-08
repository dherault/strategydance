import { McpServer } from '@modelcontextprotocol/server'

import type { ModuleAccess } from '~types'

import subagentsModule from '~modules/subagents/subagentsModule'
import SUBAGENTS_TOOLS from '~modules/subagents/subagentsTools'
import toModuleInstructions from '~modules/toModuleInstructions'
import toSingleModuleCaller from '~modules/toSingleModuleCaller'

/*
  The Subagents module's MCP server, built for one access reaching one organization, whose caller
  every tool acts as, from the run calling it, which the caller names: every tool refuses a caller
  that names none, though it lists them all. Its tools load the subagents' domain only once a call needs it, since that domain is the
  conversation runtime, which a server built to list tools, or another module's tests, never load
*/
function createSubagentsServer(access: ModuleAccess) {
  const server = new McpServer(
    { name: 'strategydance-subagents', title: subagentsModule.title, version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: toModuleInstructions('subagents', access) },
  )
  const context = { caller: toSingleModuleCaller(access) }

  for (const register of SUBAGENTS_TOOLS) register(server, context)

  return server
}

export default createSubagentsServer
