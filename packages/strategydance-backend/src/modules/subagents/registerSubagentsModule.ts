import type { McpServer } from '@modelcontextprotocol/server'

import type { ModuleAccess } from '~types'

import SUBAGENTS_TOOLS from '~modules/subagents/subagentsTools'
import toSingleModuleCaller from '~modules/toSingleModuleCaller'

/*
  Registers the Subagents module's tools, in their frozen order, on a server built for one access
  reaching one organization, whose caller every tool acts as, from the run calling it, which the
  caller names: every tool refuses a caller that names none, though it lists them all. Its tools
  load the subagents' domain only once a call needs it, since that domain is the conversation
  runtime, which a server built to list tools, or another module's tests, never load
*/
function registerSubagentsModule(server: McpServer, access: ModuleAccess) {
  const context = { caller: toSingleModuleCaller(access) }

  for (const register of SUBAGENTS_TOOLS) register(server, context)
}

export default registerSubagentsModule
