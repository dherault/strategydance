import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { TasksToolContext } from '~types'

import restoreTask from '~domain/tasks/restoreTask'

import readTasksWriteCall from '~modules/tasks/readTasksWriteCall'
import { taskIdSchema } from '~modules/tasks/tasksSchemas'
import toTasksWriteResult from '~modules/tasks/toTasksWriteResult'

const TOOL = 'restore_task'

const inputSchema = z.object({ id: taskIdSchema.describe("The deleted task's id") })

const outputSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
})

// `restore_task`: a task deleted less than a day ago, back with its links
function registerRestoreTask(server: McpServer, context: TasksToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Restore a task',
      description:
        "Restores a task of the team's board deleted less than a day ago, with its links, as the board's Undo does. Refused when a link it kept would close a loop with one made since, naming the tasks whose links would: remove one of those links first with remove_task_dependency.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readTasksWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toTasksWriteResult(await restoreTask(context.caller, args, prepared.call), context.toAddress)
    },
  )
}

export default registerRestoreTask
