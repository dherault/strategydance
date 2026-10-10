import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { TasksToolContext } from '~types'

import listTasks from '~domain/tasks/listTasks'

import { aspectsSchema } from '~modules/moduleSchemas'
import { assigneeSchema, listedTaskShape, querySchema, statusSchema } from '~modules/tasks/tasksSchemas'
import toTasksRefusal from '~modules/tasks/toTasksRefusal'
import toToolResult from '~modules/toToolResult'

const inputSchema = z.object({
  query: querySchema.optional().describe("A piece of text a task's name or description holds, whatever its case"),
  status: statusSchema.optional().describe('One column of the board'),
  assignee: assigneeSchema
    .optional()
    .describe('"me", "agent" for Strategy Dance, "unassigned", or "member:<id>" for a member'),
  aspects: aspectsSchema.optional().describe('Aspects any one of which a task is tagged with'),
  cursor: z.string().max(1000).optional().describe('The cursor the previous page gave, to read the next one'),
})

const outputSchema = z.object({
  tasks: z.array(z.object(listedTaskShape)),
  total: z.int(),
  members: z.array(z.object({ id: z.string(), name: z.string().nullable() })).optional(),
  cursor: z.string().optional(),
  isIndexComplete: z.boolean().optional(),
})

// `list_tasks`: the board's live tasks, filtered as its own filters are, a page at a time
function registerListTasks(server: McpServer, { caller, toAddress }: TasksToolContext) {
  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description:
        'Lists the team\'s task board, column by column, BACKLOG, TODO, ONGOING then DONE, in each column\'s order: each task\'s id, name, status, assignee, due date, aspects, the ids of the tasks it waits on, whether it is blocked by one not done, and when it last changed, but not its description, which read_task gives. Call it to see what the team is working on, to find a task by a piece of its name or description with `query`, or to see what is assigned to someone: `assignee` takes "me", "agent" for Strategy Dance itself, "unassigned", or "member:<id>". The first page lists the members too, by id and name, to assign tasks to. Up to 100 tasks a page, with `total`, and a `cursor` while more remain: send it back to read the next page. `isIndexComplete` false means some descriptions were not searchable yet, so a query may have missed a task: try again later.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, status, assignee, aspects, cursor }) => {
      const listed = await listTasks(caller, { query, status, assignee, aspects: aspects ?? [], cursor }, toAddress)

      if (listed.outcome !== 'listed') return toTasksRefusal(listed)

      return toToolResult(listed.page)
    },
  )
}

export default registerListTasks
