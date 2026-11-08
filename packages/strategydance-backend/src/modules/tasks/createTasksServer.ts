import { McpServer } from '@modelcontextprotocol/server'

import type { ModuleAccess } from '~types'

import createModuleToolRegistrar from '~modules/createModuleToolRegistrar'
import tasksModule from '~modules/tasks/tasksModule'
import TASKS_TOOLS from '~modules/tasks/tasksTools'
import toModuleInstructions from '~modules/toModuleInstructions'

/*
  The Tasks module's MCP server, built for one access, whose caller every tool acts as, in
  the organization its call acts in
*/
function createTasksServer(access: ModuleAccess) {
  const server = new McpServer(
    { name: 'strategydance-tasks', title: tasksModule.title, version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: toModuleInstructions('tasks', access) },
  )
  const registerTool = createModuleToolRegistrar(server, access, 'tasks')

  for (const register of TASKS_TOOLS) register(registerTool)

  return server
}

export default createTasksServer
