import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import deleteKnowledgeDocument from '~domain/knowledge/deleteKnowledgeDocument'

import { documentIdSchema } from '~modules/knowledge/knowledgeSchemas'
import readKnowledgeWriteCall from '~modules/knowledge/readKnowledgeWriteCall'
import toKnowledgeWriteResult from '~modules/knowledge/toKnowledgeWriteResult'

const TOOL = 'delete_document'

const inputSchema = z.object({ id: documentIdSchema })

const outputSchema = z.object({
  id: z.string(),
  restorableUntil: z.string(),
})

// `delete_document`: a document deleted as its page's Delete does, restorable for a day
function registerDeleteDocument(server: McpServer, context: KnowledgeToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Delete knowledge',
      description:
        "Deletes a document of the organization's knowledge, as its page's Delete does. It can be restored with restore_document for a day, until `restorableUntil`, then it is gone for good. Call it only when the member asks for the document to go.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readKnowledgeWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      // A deleted document's page shows nothing, so the answer carries no address
      return toKnowledgeWriteResult(await deleteKnowledgeDocument(context.caller, args, prepared.call), null)
    },
  )
}

export default registerDeleteDocument
