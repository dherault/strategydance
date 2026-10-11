import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { TasksToolContext } from '~types'

import createTask from '~domain/tasks/createTask'

import { aspectsSchema } from '~modules/moduleSchemas'
import readTasksWriteCall from '~modules/tasks/readTasksWriteCall'
import {
  assigneeSchema,
  descriptionSchema,
  dueDateSchema,
  statusSchema,
  taskNameSchema,
} from '~modules/tasks/tasksSchemas'
import toTasksWriteResult from '~modules/tasks/toTasksWriteResult'

const TOOL = 'create_task'

const inputSchema = z.object({
  name: taskNameSchema.describe("The task's name, one line of at most 120 characters"),
  status: statusSchema.describe('The column it starts in: BACKLOG for an idea, TODO for agreed work'),
  description: descriptionSchema.optional().describe('A short brief, in Markdown'),
  assignee: assigneeSchema
    .optional()
    .describe('"me", the default, "agent" for Strategy Dance, "unassigned", or "member:<id>" for a member'),
  dueDate: dueDateSchema.optional().describe('The day it should be done by, as YYYY-MM-DD'),
  aspects: aspectsSchema.optional().describe('The aspects of the company it is about, each at most once'),
})

const outputSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: statusSchema,
  assignee: z.string(),
  url: z.string().optional(),
})

// `create_task`: a new task at the end of its column
function registerCreateTask(server: McpServer, context: TasksToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Create a task',
      description:
        "Adds a task to the team's board, at the end of its column. Choose its `status`: BACKLOG for an idea nobody agreed to yet, TODO for work the member agreed to. It is the member's unless `assignee` says otherwise. Its description is a short brief in Markdown: headings, quotes, lists and check lists; a table or code is kept as plain paragraphs. Call it when the member agrees to turn a plan into work, one task per piece, then link them with add_task_dependency. Answers its id.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readTasksWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toTasksWriteResult(await createTask(context.caller, args, prepared.call), context.toAddress)
    },
  )
}

export default registerCreateTask
