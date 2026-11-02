import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import setKnowledgeInUse from '~domain/knowledge/setKnowledgeInUse'

import { kindSchema, knowledgeIdSchema, useSchema } from '~modules/knowledge/knowledgeSchemas'
import readKnowledgeWriteCall from '~modules/knowledge/readKnowledgeWriteCall'
import toKnowledgeWriteResult from '~modules/knowledge/toKnowledgeWriteResult'

const TOOL = 'set_knowledge_in_use'

const inputSchema = z.object({
  kind: kindSchema.describe("The item's kind"),
  id: knowledgeIdSchema.describe("The item's id, as list_knowledge gives it"),
  inUse: z.boolean().describe('true when the company uses the item, false when it no longer does'),
})

const outputSchema = z.object({ kind: kindSchema, id: z.string(), use: useSchema })

// `set_knowledge_in_use`: an item marked as one the company uses, or no longer
function registerSetKnowledgeInUse(server: McpServer, context: KnowledgeToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Mark what the company uses',
      description:
        "Marks an item of the knowledge as one the company uses, or with `inUse` false as one it no longer does: a framework while the company works with it, a tactic while it runs it, a directory once the company submitted to it, whether or not the listing is live yet. Mark it when the member takes the item up, and clear it when they drop it, so the next conversation starts from what the company does: an item cleared is kept as one the company stopped using, apart from those it never tried. Marking what the item holds already changes nothing. Answers the item's `use`, whether the company uses it and since when (`changedAt`), or null for one never marked.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readKnowledgeWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toKnowledgeWriteResult(await setKnowledgeInUse(context.caller, args, prepared.call))
    },
  )
}

export default registerSetKnowledgeInUse
