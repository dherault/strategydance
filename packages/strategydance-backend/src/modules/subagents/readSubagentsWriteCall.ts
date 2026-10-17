import type { ServerContext } from '@modelcontextprotocol/server'

import type { SubagentsToolContext } from '~types'

import readModuleWriteCall from '~modules/readModuleWriteCall'
import subagentsModule from '~modules/subagents/subagentsModule'
import toSubagentsRefusal from '~modules/subagents/toSubagentsRefusal'

// What every write tool of the Subagents module checks before anything is read or written, once the
// caller names the run calling: the write scope, and the idempotency key its call carries, if any
function readSubagentsWriteCall(
  context: SubagentsToolContext,
  serverContext: ServerContext,
  tool: string,
  args: unknown,
) {
  return readModuleWriteCall(
    context.caller,
    { scope: subagentsModule.scopes.write, readOnly: toSubagentsRefusal({ outcome: 'readOnly' }) },
    serverContext,
    tool,
    args,
  )
}

export default readSubagentsWriteCall
