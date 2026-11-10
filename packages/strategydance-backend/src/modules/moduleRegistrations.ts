import type { McpServer } from '@modelcontextprotocol/server'
import type { ModuleName } from 'strategydance-core'

import type { ModuleAccess } from '~types'

import registerBudgetModule from '~modules/budget/registerBudgetModule'
import registerDocumentsModule from '~modules/documents/registerDocumentsModule'
import registerKnowledgeModule from '~modules/knowledge/registerKnowledgeModule'
import registerSubagentsModule from '~modules/subagents/registerSubagentsModule'
import registerTasksModule from '~modules/tasks/registerTasksModule'

// How each module registers its tools on a server built for one access, by its name in `MODULES`
const MODULE_REGISTRATIONS: Record<ModuleName, (server: McpServer, access: ModuleAccess) => void> = {
  documents: registerDocumentsModule,
  tasks: registerTasksModule,
  budget: registerBudgetModule,
  subagents: registerSubagentsModule,
  knowledge: registerKnowledgeModule,
}

export default MODULE_REGISTRATIONS
