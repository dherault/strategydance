import type { CallToolResult, ServerContext } from '@modelcontextprotocol/server'
import type { ModuleScope } from 'strategydance-core'

import type { ModuleCall, ModuleCaller } from '~types'

import { MAX_MODULE_IDEMPOTENCY_KEY_LENGTH, MODULE_IDEMPOTENCY_KEY_META } from '~constants'

import readModuleCall from '~modules/readModuleCall'
import toToolRefusal from '~modules/toToolRefusal'

type ReadModuleWriteCallResult =
  | { outcome: 'ready'; call: ModuleCall | null }
  | { outcome: 'refused'; result: CallToolResult }

// What a module's write tools are refused with when a connection may only read, in the module's words
type ModuleWriteAccess = {
  scope: ModuleScope
  readOnly: CallToolResult
}

/*
  What every write tool of a module checks before anything is read or written: that the caller may
  write, which a connection granted read alone may not, and the idempotency key its call carries, if
  any
*/
function readModuleWriteCall(
  caller: ModuleCaller,
  { scope, readOnly }: ModuleWriteAccess,
  serverContext: ServerContext,
  tool: string,
  args: unknown,
): ReadModuleWriteCallResult {
  if (!caller.scopes.includes(scope)) return { outcome: 'refused', result: readOnly }

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

export default readModuleWriteCall
