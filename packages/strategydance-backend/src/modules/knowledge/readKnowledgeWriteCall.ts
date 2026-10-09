import type { CallToolResult, ServerContext } from '@modelcontextprotocol/server'

import type { KnowledgeToolContext, ModuleCall } from '~types'

import { MAX_MODULE_IDEMPOTENCY_KEY_LENGTH, MODULE_IDEMPOTENCY_KEY_META } from '~constants'

import knowledgeModule from '~modules/knowledge/knowledgeModule'
import toKnowledgeRefusal from '~modules/knowledge/toKnowledgeRefusal'
import readModuleCall from '~modules/readModuleCall'
import toToolRefusal from '~modules/toToolRefusal'

type ReadKnowledgeWriteCallResult =
  | { outcome: 'ready'; call: ModuleCall | null }
  | { outcome: 'refused'; result: CallToolResult }

/*
  What every write tool of the Knowledge module checks before anything is read or written: that the
  caller may write, which a connection granted read alone may not, and the idempotency key its call
  carries, if any
*/
function readKnowledgeWriteCall(
  context: KnowledgeToolContext,
  serverContext: ServerContext,
  tool: string,
  args: unknown,
): ReadKnowledgeWriteCallResult {
  if (!context.caller.scopes.includes(knowledgeModule.scopes.write)) {
    return { outcome: 'refused', result: toKnowledgeRefusal({ outcome: 'readOnly' }) }
  }

  const read = readModuleCall(serverContext, tool, args)

  if (read.outcome === 'invalidKey') {
    return {
      outcome: 'refused',
      result: toToolRefusal(
        `The idempotency key in _meta["${MODULE_IDEMPOTENCY_KEY_META}"] is a string of 1 to ${MAX_MODULE_IDEMPOTENCY_KEY_LENGTH} characters, without U+0000.`,
      ),
    }
  }

  return { outcome: 'ready', call: read.call }
}

export default readKnowledgeWriteCall
