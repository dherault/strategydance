import type { McpServer } from '@modelcontextprotocol/server'

import type { ModuleAccess } from '~types'

import createModuleToolRegistrar from '~modules/createModuleToolRegistrar'
import DOCUMENTS_TOOLS from '~modules/documents/documentsTools'

/*
  Registers the Documents module's tools, in their frozen order, on a server built for one access, whose
  caller every tool acts as, in the organization its call acts in
*/
function registerDocumentsModule(server: McpServer, access: ModuleAccess) {
  const registerTool = createModuleToolRegistrar(server, access, 'documents')

  for (const register of DOCUMENTS_TOOLS) register(registerTool)
}

export default registerDocumentsModule
