import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { TasksToolContext } from '~types'

import deleteTask from '~domain/tasks/deleteTask'

import readTasksWriteCall from '~modules/tasks/readTasksWriteCall'
import { taskIdSchema } from '~modules/tasks/tasksSchemas'
import toTasksWriteResult from '~modules/tasks/toTasksWriteResult'

const TOOL = 'delete_task'

const inputSchema = z.object({ id: taskIdSchema.describe("The task's id") })

const outputSchema = z.object({
  id: z.string(),
  restorableUntil: z.string(),
})

// `delete_task`: a task deleted as its dialog's Delete does, restorable for a day
function registerDeleteTask(server: McpServer, context: TasksToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Delete a task',
      description:
        "Deletes a task of the team's board, as its dialog's Delete does, keeping its links. It can be restored with them by restore_task for a day, until `restorableUntil`, then it is gone for good. Call it only when the member asks for the task to go.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readTasksWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      // A deleted task's dialog shows nothing, so the answer carries no address
      return toTasksWriteResult(await deleteTask(context.caller, args, prepared.call), null)
    },
  )
}

export default registerDeleteTask
