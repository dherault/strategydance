import type { McpServer } from '@modelcontextprotocol/server'
import type { ModuleName } from 'strategydance-core'

import type { ModuleAccess } from '~types'

import createBudgetServer from '~modules/budget/createBudgetServer'
import createDocumentsServer from '~modules/documents/createDocumentsServer'
import createKnowledgeServer from '~modules/knowledge/createKnowledgeServer'
import createSubagentsServer from '~modules/subagents/createSubagentsServer'
import createTasksServer from '~modules/tasks/createTasksServer'

// Each module's server, built for one access, by the module's name in `MODULES`
const MODULE_SERVERS: Record<ModuleName, (access: ModuleAccess) => McpServer> = {
  documents: createDocumentsServer,
  tasks: createTasksServer,
  budget: createBudgetServer,
  subagents: createSubagentsServer,
  knowledge: createKnowledgeServer,
}

export default MODULE_SERVERS
