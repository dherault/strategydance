import type { McpServer } from '@modelcontextprotocol/server'
import type { ModuleName } from 'strategydance-core'

import type { ModuleCaller } from '~types'

import createKnowledgeServer from '~modules/knowledge/createKnowledgeServer'
import createTasksServer from '~modules/tasks/createTasksServer'

// Each module's server, built for one caller, by the module's name in `MODULES`
const MODULE_SERVERS: Record<ModuleName, (caller: ModuleCaller) => McpServer> = {
  knowledge: createKnowledgeServer,
  tasks: createTasksServer,
}

export default MODULE_SERVERS
