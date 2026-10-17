import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { SubagentsToolContext } from '~types'

import readSubagentsWriteCall from '~modules/subagents/readSubagentsWriteCall'
import { attachmentsSchema, briefSchema, titleSchema } from '~modules/subagents/subagentsSchemas'
import toSubagentsRefusal from '~modules/subagents/toSubagentsRefusal'
import toSubagentsWriteResult from '~modules/subagents/toSubagentsWriteResult'

const TOOL = 'launch_subagent'

const inputSchema = z.object({
  title: titleSchema.describe('What the subagent does, in one line'),
  brief: briefSchema.describe(
    'Everything the subagent needs to carry out the work, which is all it knows of this conversation',
  ),
  attachments: attachmentsSchema
    .optional()
    .describe("Ids of files this conversation has sent, as the member's messages name them, to hand the subagent"),
})

const outputSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['QUEUED', 'WAITING_FOR_SLOT']),
})

// `launch_subagent`: a subagent of the calling conversation, launched on a brief, from the run calling
function registerLaunchSubagent(server: McpServer, context: SubagentsToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Launch a subagent',
      description:
        "Launches a subagent: a run of Strategy Dance's agent of its own, which carries out `brief` in parallel with you, with your tools but asking the member nothing, and writes a report when it ends. The brief is all it knows of this conversation, so put in it everything it needs. `attachments` hands it files this conversation has sent, by the ids the member's messages name them with. Answers its id and whether it is QUEUED or WAITING_FOR_SLOT, for one of the member's five that run at once. Nothing waits on it: read it, and its report once written, with read_subagent.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, serverContext) => {
      if (!context.caller.launcher) return toSubagentsRefusal({ outcome: 'noLauncher' })

      const prepared = readSubagentsWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      // The subagents' domain is the conversation runtime, loaded once a call needs it
      const { default: launchSubagentForAgent } = await import('~domain/subagents/launchSubagentForAgent')

      return toSubagentsWriteResult(await launchSubagentForAgent(context.caller, args, prepared.call))
    },
  )
}

export default registerLaunchSubagent
