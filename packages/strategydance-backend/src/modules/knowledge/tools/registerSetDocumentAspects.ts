import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import setKnowledgeDocumentAspects from '~domain/knowledge/setKnowledgeDocumentAspects'

import { documentIdSchema } from '~modules/knowledge/knowledgeSchemas'
import readKnowledgeWriteCall from '~modules/knowledge/readKnowledgeWriteCall'
import toKnowledgeWriteResult from '~modules/knowledge/toKnowledgeWriteResult'
import { aspectSchema, aspectsSchema } from '~modules/moduleSchemas'

const TOOL = 'set_document_aspects'

const inputSchema = z.object({
  id: documentIdSchema,
  aspects: aspectsSchema.describe('Every aspect it is about, each at most once, replacing those it had'),
})

const outputSchema = z.object({
  id: z.string(),
  aspects: z.array(aspectSchema),
  url: z.string().optional(),
})

// `set_document_aspects`: the aspects a document is tagged with, replaced whole
function registerSetDocumentAspects(server: McpServer, context: KnowledgeToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Tag knowledge',
      description:
        "Tags a document of the organization's knowledge with the aspects of the company it is about, replacing those it had: send every aspect it should keep. Call it when a document is about an aspect it is not tagged with, so it shows on that aspect's page.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readKnowledgeWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toKnowledgeWriteResult(
        await setKnowledgeDocumentAspects(context.caller, args, prepared.call),
        context.toAddress,
      )
    },
  )
}

export default registerSetDocumentAspects
