import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { TasksToolContext } from '~types'

import updateTask from '~domain/tasks/updateTask'

import { aspectsSchema } from '~modules/moduleSchemas'
import readTasksWriteCall from '~modules/tasks/readTasksWriteCall'
import {
  assigneeSchema,
  descriptionSchema,
  dueDateSchema,
  statusSchema,
  taskIdSchema,
  taskNameSchema,
  taskReferencesSchema,
} from '~modules/tasks/tasksSchemas'
import toTasksWriteResult from '~modules/tasks/toTasksWriteResult'

const TOOL = 'update_task'

// The fields a call can change, at least one of which it names
const FIELDS = ['name', 'description', 'status', 'assignee', 'dueDate', 'aspects'] as const

const inputSchema = z
  .object({
    id: taskIdSchema.describe("The task's id"),
    name: taskNameSchema.optional().describe('A new name, one line of at most 120 characters'),
    description: descriptionSchema
      .optional()
      .describe('The whole description replaced, in Markdown, "" clearing it, with `version`'),
    version: z.string().max(200).optional().describe('The version read_task gave, required with `description`'),
    status: statusSchema.optional().describe('The column the task moves to'),
    beforeId: taskIdSchema.optional().describe('A task of that column the task moves before, its end otherwise'),
    assignee: assigneeSchema
      .optional()
      .describe('"me", "agent" for Strategy Dance, "unassigned", or "member:<id>" for a member'),
    dueDate: dueDateSchema
      .nullable()
      .optional()
      .describe('The day it should be done by, as YYYY-MM-DD, null to clear it'),
    aspects: aspectsSchema.optional().describe('The aspects it is about, replacing them all, each at most once'),
  })
  .superRefine((args, context) => {
    if (FIELDS.every(field => args[field] === undefined)) {
      context.addIssue({ code: 'custom', message: `Name at least one of ${FIELDS.join(', ')} to change` })
    }

    if (args.beforeId !== undefined && args.status === undefined) {
      context.addIssue({ code: 'custom', message: 'beforeId goes with status, the column it names a task of' })
    }

    if (args.version !== undefined && args.description === undefined) {
      context.addIssue({ code: 'custom', message: 'version goes with description, which it lets you replace' })
    }
  })

const outputSchema = z.object({
  id: z.string(),
  version: z.string().optional(),
  canStartNow: taskReferencesSchema.optional(),
  url: z.string().optional(),
})

// `update_task`: the fields of a task a call names, and no other
function registerUpdateTask(server: McpServer, context: TasksToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Update a task',
      description:
        'Changes the fields of a task of the team\'s board that the call names, and no other, so a member changing another field meanwhile keeps their change. `status` moves the task to that column, before the task `beforeId` names there or at the column\'s end. `description` replaces the whole description, in Markdown, `""` clearing it, and takes the `version` read_task gave, refused when someone changed the description since. `assignee` takes "me", "agent" for Strategy Dance, "unassigned" or "member:<id>", `dueDate` null clears the day, and `aspects` replaces them all. A move to DONE answers the tasks that can start now (`canStartNow`): tell the member. A description replaced answers its new version.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readTasksWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toTasksWriteResult(await updateTask(context.caller, args, prepared.call), context.toAddress)
    },
  )
}

export default registerUpdateTask
