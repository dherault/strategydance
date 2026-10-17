import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { SubagentsToolContext } from '~types'

import { cursorSchema, statusSchema } from '~modules/subagents/subagentsSchemas'
import toSubagentsRefusal from '~modules/subagents/toSubagentsRefusal'
import toToolResult from '~modules/toToolResult'

const inputSchema = z.object({
  cursor: cursorSchema.optional().describe('The cursor the previous page gave, to read the next one'),
})

const outputSchema = z.object({
  subagents: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: statusSchema,
      startedAt: z.string(),
      endedAt: z.string().nullable(),
      hasReport: z.boolean(),
    }),
  ),
  cursor: z.string().optional(),
})

// `list_subagents`: the subagents the calling conversation launched, newest first, a page at a time
function registerListSubagents(server: McpServer, { caller }: SubagentsToolContext) {
  server.registerTool(
    'list_subagents',
    {
      title: 'List subagents',
      description:
        "Lists the subagents this conversation launched, newest first: each one's id, title, status (QUEUED, WAITING_FOR_SLOT for one of the member's five that run at once, WORKING, REPORTED, STOPPED, FAILED or INTERRUPTED), when it started and when it ended, and whether its report is written, which read_subagent reads. Up to 20 a page, with a `cursor` while more remain: send it back to read the next page. A subagent a retry discarded is not listed.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ cursor }) => {
      if (!caller.launcher) return toSubagentsRefusal({ outcome: 'noLauncher' })

      // The subagents' domain is the conversation runtime, loaded once a call needs it
      const { default: listSubagents } = await import('~domain/subagents/listSubagents')
      const listed = await listSubagents(caller, { cursor })

      if (listed.outcome !== 'listed') return toSubagentsRefusal(listed)

      return toToolResult({ subagents: listed.subagents, ...(listed.cursor && { cursor: listed.cursor }) })
    },
  )
}

export default registerListSubagents
