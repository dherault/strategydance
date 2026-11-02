import type { ServerContext } from '@modelcontextprotocol/server'

import type { KnowledgeToolContext } from '~types'

import knowledgeModule from '~modules/knowledge/knowledgeModule'
import toKnowledgeRefusal from '~modules/knowledge/toKnowledgeRefusal'
import readModuleWriteCall from '~modules/readModuleWriteCall'

// What every write tool of the Knowledge module checks before anything is read or written: the write
// scope, and the idempotency key its call carries, if any
function readKnowledgeWriteCall(
  context: KnowledgeToolContext,
  serverContext: ServerContext,
  tool: string,
  args: unknown,
) {
  return readModuleWriteCall(
    context.caller,
    { scope: knowledgeModule.scopes.write, readOnly: toKnowledgeRefusal({ outcome: 'readOnly' }) },
    serverContext,
    tool,
    args,
  )
}

export default readKnowledgeWriteCall
