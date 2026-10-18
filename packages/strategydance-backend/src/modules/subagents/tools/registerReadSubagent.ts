import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { SubagentsToolContext } from '~types'

import {
  cursorSchema,
  integrationCallEndingSchema,
  statusSchema,
  subagentIdSchema,
} from '~modules/subagents/subagentsSchemas'
import toSubagentsRefusal from '~modules/subagents/toSubagentsRefusal'
import toToolResult from '~modules/toToolResult'

const inputSchema = z.object({
  id: subagentIdSchema.describe("The subagent's id"),
  cursor: cursorSchema
    .optional()
    .describe("The cursor the previous page gave, to read the next page of the subagent's writes"),
})

const outputSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: statusSchema,
  step: z.string().nullable(),
  runs: z.int(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  report: z.string().nullable(),
  writes: z.array(z.object({ tool: z.string(), documentId: z.string().optional(), taskId: z.string().optional() })),
  total: z.int(),
  cursor: z.string().optional(),
  integrationCalls: z.array(
    z.object({ integration: z.string(), tool: z.string(), ending: integrationCallEndingSchema }),
  ),
  integrationCallTotal: z.int(),
})

// `read_subagent`: one subagent of the calling conversation, with a page of what it wrote
function registerReadSubagent(server: McpServer, { caller }: SubagentsToolContext) {
  server.registerTool(
    'read_subagent',
    {
      title: 'Read a subagent',
      description:
        "Reads one subagent this conversation launched: its status, its step while it works, how many runs it took, its report once written, and what it wrote through the modules, oldest first: each write's tool and the document (`documentId`) or task (`taskId`) it wrote, which a link to doc:<id> or task:<id> mentions. Up to 50 writes a page, with `total`, and a `cursor` while more remain, which pages the writes alone: send it back to read the next page. Every page also lists the calls it made to the organization's integrations, oldest first, with `integrationCallTotal`: each call's integration and tool, by the names they had then, and how it ended: SUCCEEDED; FAILED, answered with an error; UNANSWERED, when its server never answered, so it may have run; or RUNNING. A call to another company's server is not undone by any restore: check one UNANSWERED before you propose it again.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, cursor }) => {
      if (!caller.launcher) return toSubagentsRefusal({ outcome: 'noLauncher' })

      // The subagents' domain is the conversation runtime, loaded once a call needs it
      const { default: readSubagent } = await import('~domain/subagents/readSubagent')
      const read = await readSubagent(caller, { id, cursor })

      if (read.outcome !== 'read') return toSubagentsRefusal(read)

      return toToolResult(read.subagent)
    },
  )
}

export default registerReadSubagent
