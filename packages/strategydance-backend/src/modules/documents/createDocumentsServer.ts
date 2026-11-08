import { McpServer } from '@modelcontextprotocol/server'

import type { ModuleAccess } from '~types'

import createModuleToolRegistrar from '~modules/createModuleToolRegistrar'
import documentsModule from '~modules/documents/documentsModule'
import DOCUMENTS_TOOLS from '~modules/documents/documentsTools'
import toModuleInstructions from '~modules/toModuleInstructions'

/*
  The Documents module's MCP server, built for one access, whose caller every tool acts as, in
  the organization its call acts in
*/
function createDocumentsServer(access: ModuleAccess) {
  const server = new McpServer(
    { name: 'strategydance-documents', title: documentsModule.title, version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: toModuleInstructions('documents', access) },
  )
  const registerTool = createModuleToolRegistrar(server, access, 'documents')

  for (const register of DOCUMENTS_TOOLS) register(registerTool)

  return server
}

export default createDocumentsServer
