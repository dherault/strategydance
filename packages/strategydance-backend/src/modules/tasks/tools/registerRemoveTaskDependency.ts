import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { TasksToolContext } from '~types'

import removeTaskDependency from '~domain/tasks/removeTaskDependency'

import readTasksWriteCall from '~modules/tasks/readTasksWriteCall'
import { taskIdSchema } from '~modules/tasks/tasksSchemas'
import toTasksWriteResult from '~modules/tasks/toTasksWriteResult'

const TOOL = 'remove_task_dependency'

const inputSchema = z.object({
  id: taskIdSchema.describe('The id of the task that waits'),
  dependsOnId: taskIdSchema.describe('The id of the task it waits on, which may be deleted'),
})

const outputSchema = z.object({
  id: z.string(),
  dependsOnId: z.string(),
  isBlocked: z.boolean(),
  canStart: z.boolean(),
  url: z.string().optional(),
})

// `remove_task_dependency`: a task stops waiting on another
function registerRemoveTaskDependency(server: McpServer, context: TasksToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Unlink tasks',
      description:
        "Makes a task of the team's board stop waiting on another. Refused when it does not wait on it. Answers whether the task is still blocked, and whether it can start now: it is not done and waits on nothing unfinished.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readTasksWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toTasksWriteResult(await removeTaskDependency(context.caller, args, prepared.call), context.toAddress)
    },
  )
}

export default registerRemoveTaskDependency
