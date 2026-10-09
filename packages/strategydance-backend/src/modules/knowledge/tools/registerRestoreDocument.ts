import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import restoreKnowledgeDocument from '~domain/knowledge/restoreKnowledgeDocument'

import { documentIdSchema } from '~modules/knowledge/knowledgeSchemas'
import readKnowledgeWriteCall from '~modules/knowledge/readKnowledgeWriteCall'
import toKnowledgeWriteResult from '~modules/knowledge/toKnowledgeWriteResult'

const TOOL = 'restore_document'

const inputSchema = z.object({ id: documentIdSchema })

const outputSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
})

// `restore_document`: a document deleted less than a day ago, brought back
function registerRestoreDocument(server: McpServer, context: KnowledgeToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Restore knowledge',
      description:
        "Restores a document of the organization's knowledge deleted less than a day ago, as its page's Undo does. Call it when the member wants back a document that was deleted.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readKnowledgeWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toKnowledgeWriteResult(
        await restoreKnowledgeDocument(context.caller, args, prepared.call),
        context.toAddress,
      )
    },
  )
}

export default registerRestoreDocument
