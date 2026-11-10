import type { McpServer } from '@modelcontextprotocol/server'

import type { ModuleAccess } from '~types'

import KNOWLEDGE_TOOLS from '~modules/knowledge/knowledgeTools'
import toSingleModuleCaller from '~modules/toSingleModuleCaller'

/*
  Registers the Knowledge module's tools, in their frozen order, on a server built for one access
  reaching one organization, whose caller every tool acts as: the catalogue is the same for every
  organization, and what the company uses of it is kept as that member
*/
function registerKnowledgeModule(server: McpServer, access: ModuleAccess) {
  const context = { caller: toSingleModuleCaller(access) }

  for (const register of KNOWLEDGE_TOOLS) register(server, context)
}

export default registerKnowledgeModule
