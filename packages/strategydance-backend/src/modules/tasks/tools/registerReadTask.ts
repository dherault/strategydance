import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { TasksToolContext } from '~types'

import readTask from '~domain/tasks/readTask'

import { aspectSchema } from '~modules/moduleSchemas'
import { statusSchema, taskIdSchema, taskReferenceShape } from '~modules/tasks/tasksSchemas'
import toTasksRefusal from '~modules/tasks/toTasksRefusal'
import toToolResult from '~modules/toToolResult'

const inputSchema = z.object({ id: taskIdSchema.describe("The task's id") })

const linksSchema = z.object({
  tasks: z.array(z.object({ ...taskReferenceShape, status: statusSchema })),
  count: z.int(),
})

const outputSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: statusSchema,
  assignee: z.string(),
  assigneeName: z.string().nullable().optional(),
  dueDate: z.string().nullable(),
  aspects: z.array(aspectSchema),
  createdBy: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isBlocked: z.boolean(),
  dependsOn: linksSchema,
  waitedOnBy: linksSchema,
  description: z.string(),
  isDescriptionComplete: z.boolean(),
  version: z.string().optional(),
  url: z.string().optional(),
})

// `read_task`: a live task, its description and its links both ways
function registerReadTask(server: McpServer, { caller, toAddress }: TasksToolContext) {
  server.registerTool(
    'read_task',
    {
      title: 'Read a task',
      description:
        "Reads a task of the team's board: its fields, who created it and when, its description as Markdown with its `version`, the tasks it waits on (`dependsOn`) and those waiting on it (`waitedOnBy`), each with id, name and status, the first 20 of each with their `count`, and whether it is blocked. Call it before changing a task's description, which takes the `version` it gives. A description too long to answer whole comes as its plain text with `isDescriptionComplete` false and no version: you can read it but not replace it.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const read = await readTask(caller, { id }, toAddress)

      if (read.outcome !== 'read') return toTasksRefusal(read)

      return toToolResult(read.task)
    },
  )
}

export default registerReadTask
