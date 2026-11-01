import type { MessageDescriptor } from 'react-intl'
import type { ModuleName } from 'strategydance-core'

import moduleMessages from '~data/intl/messages/module'

type ModuleMessages = {
  name: MessageDescriptor
  readAccess: MessageDescriptor
  writeAccess: MessageDescriptor
  // The tooltip of the button on the module's page that tells how to connect an agent to it
  agentsButton: MessageDescriptor
}

/*
  Keyed by every module `MODULES` lists, so a module added there fails the typecheck until it is
  worded here. `MODULES`' own title is the server's, in English, for what MCP clients show
*/
const MODULE_MESSAGES: Record<ModuleName, ModuleMessages> = {
  documents: {
    name: moduleMessages.documentsName,
    readAccess: moduleMessages.documentsReadAccess,
    writeAccess: moduleMessages.documentsWriteAccess,
    agentsButton: moduleMessages.documentsAgentsButton,
  },
  tasks: {
    name: moduleMessages.tasksName,
    readAccess: moduleMessages.tasksReadAccess,
    writeAccess: moduleMessages.tasksWriteAccess,
    agentsButton: moduleMessages.tasksAgentsButton,
  },
  budget: {
    name: moduleMessages.budgetName,
    readAccess: moduleMessages.budgetReadAccess,
    writeAccess: moduleMessages.budgetWriteAccess,
    agentsButton: moduleMessages.budgetAgentsButton,
  },
  // Served to no external agent yet, so no page shows these, but every module is worded
  subagents: {
    name: moduleMessages.subagentsName,
    readAccess: moduleMessages.subagentsReadAccess,
    writeAccess: moduleMessages.subagentsWriteAccess,
    agentsButton: moduleMessages.subagentsAgentsButton,
  },
  // Served to no external agent yet either, so no page shows these, but every module is worded
  knowledge: {
    name: moduleMessages.knowledgeName,
    readAccess: moduleMessages.knowledgeReadAccess,
    writeAccess: moduleMessages.knowledgeWriteAccess,
    agentsButton: moduleMessages.knowledgeAgentsButton,
  },
}

// What a module is called in the member's words, what its read access, and its write access beside
// it, let an agent do there, and what its page's agents button offers
function getModuleMessages(module: ModuleName) {
  return MODULE_MESSAGES[module]
}

export default getModuleMessages
