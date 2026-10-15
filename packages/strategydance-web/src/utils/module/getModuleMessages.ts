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
  knowledge: {
    name: moduleMessages.knowledgeName,
    readAccess: moduleMessages.knowledgeReadAccess,
    writeAccess: moduleMessages.knowledgeWriteAccess,
    agentsButton: moduleMessages.knowledgeAgentsButton,
  },
  tasks: {
    name: moduleMessages.tasksName,
    readAccess: moduleMessages.tasksReadAccess,
    writeAccess: moduleMessages.tasksWriteAccess,
    agentsButton: moduleMessages.tasksAgentsButton,
  },
}

// What a module is called in the member's words, what its read access, and its write access beside
// it, let an agent do there, and what its page's agents button offers
function getModuleMessages(module: ModuleName) {
  return MODULE_MESSAGES[module]
}

export default getModuleMessages
