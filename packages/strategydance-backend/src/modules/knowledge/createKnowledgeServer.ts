import { McpServer } from '@modelcontextprotocol/server'

import type { ModuleAccess } from '~types'

import knowledgeModule from '~modules/knowledge/knowledgeModule'
import KNOWLEDGE_TOOLS from '~modules/knowledge/knowledgeTools'
import toModuleInstructions from '~modules/toModuleInstructions'
import toSingleModuleCaller from '~modules/toSingleModuleCaller'

/*
  The Knowledge module's MCP server, built for one access reaching one organization, whose caller
  every tool acts as: the catalogue is the same for every organization, and what the company uses
  of it is kept as that member
*/
function createKnowledgeServer(access: ModuleAccess) {
  const server = new McpServer(
    { name: 'strategydance-knowledge', title: knowledgeModule.title, version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: toModuleInstructions('knowledge', access) },
  )

  const context = { caller: toSingleModuleCaller(access) }

  for (const register of KNOWLEDGE_TOOLS) register(server, context)

  return server
}

export default createKnowledgeServer
