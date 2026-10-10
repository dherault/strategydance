import type { ServerContext } from '@modelcontextprotocol/server'

import type { TasksToolContext } from '~types'

import readModuleWriteCall from '~modules/readModuleWriteCall'
import tasksModule from '~modules/tasks/tasksModule'
import toTasksRefusal from '~modules/tasks/toTasksRefusal'

// What every write tool of the Tasks module checks before anything is read or written: the write
// scope, and the idempotency key its call carries, if any
function readTasksWriteCall(context: TasksToolContext, serverContext: ServerContext, tool: string, args: unknown) {
  return readModuleWriteCall(
    context.caller,
    { scope: tasksModule.scopes.write, readOnly: toTasksRefusal({ outcome: 'readOnly' }) },
    serverContext,
    tool,
    args,
  )
}

export default readTasksWriteCall
