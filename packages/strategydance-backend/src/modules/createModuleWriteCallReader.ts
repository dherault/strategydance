import type { CallToolResult, ServerContext } from '@modelcontextprotocol/server'
import type { ModuleScope } from 'strategydance-core'

import type { ModuleCaller } from '~types'

import readModuleWriteCall from '~modules/readModuleWriteCall'

/*
  A module's `read<Module>WriteCall`, which every write tool of the module calls before anything is
  read or written: its write scope, refused through the module's own refusal to a connection that
  may only read, and the idempotency key the call carries, if any
*/
function createModuleWriteCallReader(
  scope: ModuleScope,
  toRefusal: (refusal: { outcome: 'readOnly' }) => CallToolResult,
) {
  return (context: { caller: ModuleCaller }, serverContext: ServerContext, tool: string, args: unknown) =>
    readModuleWriteCall(
      context.caller,
      { scope, readOnly: toRefusal({ outcome: 'readOnly' }) },
      serverContext,
      tool,
      args,
    )
}

export default createModuleWriteCallReader
