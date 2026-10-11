import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { TasksToolContext } from '~types'

import addTaskDependency from '~domain/tasks/addTaskDependency'

import readTasksWriteCall from '~modules/tasks/readTasksWriteCall'
import { taskIdSchema } from '~modules/tasks/tasksSchemas'
import toTasksWriteResult from '~modules/tasks/toTasksWriteResult'

const TOOL = 'add_task_dependency'

const inputSchema = z.object({
  id: taskIdSchema.describe('The id of the task that waits'),
  dependsOnId: taskIdSchema.describe('The id of the task it waits on'),
})

const outputSchema = z.object({
  id: z.string(),
  dependsOnId: z.string(),
  isNew: z.boolean(),
  isBlocked: z.boolean(),
  url: z.string().optional(),
})

// `add_task_dependency`: a task waits on another
function registerAddTaskDependency(server: McpServer, context: TasksToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Link tasks',
      description:
        "Makes a task of the team's board wait on another, which keeps it from starting until the other is done. Call it to put a plan's tasks in order. Refused when the link would close a loop, which the refusal names, and past 50 links a task. A link that exists already changes nothing, which `isNew` false says. Answers whether the task is blocked now.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readTasksWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toTasksWriteResult(await addTaskDependency(context.caller, args, prepared.call), context.toAddress)
    },
  )
}

export default registerAddTaskDependency
