import type { ModuleName } from 'strategydance-core'

import type { ModuleInstructions } from '~types'

import BUDGET_INSTRUCTIONS from '~modules/budget/budgetInstructions'
import DOCUMENTS_INSTRUCTIONS from '~modules/documents/documentsInstructions'
import KNOWLEDGE_INSTRUCTIONS from '~modules/knowledge/knowledgeInstructions'
import SUBAGENTS_INSTRUCTIONS from '~modules/subagents/subagentsInstructions'
import TASKS_INSTRUCTIONS from '~modules/tasks/tasksInstructions'

// What each module tells an agent of itself, by the module's name in `MODULES`
const MODULE_INSTRUCTIONS: Record<ModuleName, ModuleInstructions> = {
  documents: DOCUMENTS_INSTRUCTIONS,
  tasks: TASKS_INSTRUCTIONS,
  budget: BUDGET_INSTRUCTIONS,
  subagents: SUBAGENTS_INSTRUCTIONS,
  knowledge: KNOWLEDGE_INSTRUCTIONS,
}

export default MODULE_INSTRUCTIONS
