import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { SubagentsToolContext } from '~types'

import readSubagentsWriteCall from '~modules/subagents/readSubagentsWriteCall'
import { statusSchema, subagentIdSchema } from '~modules/subagents/subagentsSchemas'
import toSubagentsRefusal from '~modules/subagents/toSubagentsRefusal'
import toSubagentsWriteResult from '~modules/subagents/toSubagentsWriteResult'

const TOOL = 'stop_subagent'

const inputSchema = z.object({ id: subagentIdSchema.describe("The subagent's id") })

const outputSchema = z.object({
  id: z.string(),
  isEnded: z.boolean(),
  status: statusSchema.optional(),
})

// `stop_subagent`: a subagent of the calling conversation asked to stop, as its row's Stop will
function registerStopSubagent(server: McpServer, context: SubagentsToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Stop a subagent',
      description:
        'Asks a subagent this conversation launched to stop: a queued one, or one waiting for a slot, ends at once, and a working one at its next step, each writing its report from what it had, which read_subagent reads. One that has ended already is answered with `isEnded` and how it ended, and nothing changes.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      if (!context.caller.launcher) return toSubagentsRefusal({ outcome: 'noLauncher' })

      const prepared = readSubagentsWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      // The subagents' domain is the conversation runtime, loaded once a call needs it
      const { default: stopSubagent } = await import('~domain/subagents/stopSubagent')

      return toSubagentsWriteResult(await stopSubagent(context.caller, args, prepared.call))
    },
  )
}

export default registerStopSubagent
