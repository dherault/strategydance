import type { McpServer } from '@modelcontextprotocol/server'
import { DirectoryStatus } from 'strategydance-core'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import setDirectoryStatus from '~domain/knowledge/setDirectoryStatus'

import { knowledgeIdSchema, useSchema } from '~modules/knowledge/knowledgeSchemas'
import readKnowledgeWriteCall from '~modules/knowledge/readKnowledgeWriteCall'
import toKnowledgeWriteResult from '~modules/knowledge/toKnowledgeWriteResult'

const TOOL = 'set_directory_status'

const inputSchema = z.object({
  id: knowledgeIdSchema.describe("The directory's id, as list_knowledge gives it"),
  status: z
    .enum(['TO_DO', ...Object.values(DirectoryStatus)])
    .describe('SUBMITTED, LISTED, DISMISSED, or TO_DO to take a status back'),
})

const outputSchema = z.object({ id: z.string(), use: useSchema })

// `set_directory_status`: where the company stands with a directory it was submitted to, or not
function registerSetDirectoryStatus(server: McpServer, context: KnowledgeToolContext) {
  server.registerTool(
    TOOL,
    {
      title: "Set a directory's status",
      description:
        "Sets where the company stands with a directory of the knowledge, as the team's directories page does: SUBMITTED once the member sent their product, whether or not the listing is live yet, LISTED once it is live, DISMISSED when they decide against the directory, which you then never suggest again, and TO_DO to take a status back. Set it when the member tells you, so the next conversation and the page start from where the company stands. A directory submitted or listed is one the company uses (`inUse`). Setting the status it holds already changes nothing. Answers the directory's `use`: whether the company uses it, its `status` and since when (`changedAt`), or null for one never marked.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readKnowledgeWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toKnowledgeWriteResult(await setDirectoryStatus(context.caller, args, prepared.call))
    },
  )
}

export default registerSetDirectoryStatus
