import type { McpServer } from '@modelcontextprotocol/server'

import type { ModuleAccess } from '~types'

import createModuleToolRegistrar from '~modules/createModuleToolRegistrar'
import TASKS_TOOLS from '~modules/tasks/tasksTools'

/*
  Registers the Tasks module's tools, in their frozen order, on a server built for one access, whose
  caller every tool acts as, in the organization its call acts in
*/
function registerTasksModule(server: McpServer, access: ModuleAccess) {
  const registerTool = createModuleToolRegistrar(server, access, 'tasks')

  for (const register of TASKS_TOOLS) register(registerTool)
}

export default registerTasksModule
