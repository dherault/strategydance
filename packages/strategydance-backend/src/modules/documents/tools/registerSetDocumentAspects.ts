import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { DocumentsToolContext } from '~types'

import setDocumentAspects from '~domain/documents/setDocumentAspects'

import documentsModule from '~modules/documents/documentsModule'
import { documentIdSchema } from '~modules/documents/documentsSchemas'
import readDocumentsWriteCall from '~modules/documents/readDocumentsWriteCall'
import toDocumentsWriteResult from '~modules/documents/toDocumentsWriteResult'
import { aspectSchema, aspectsSchema } from '~modules/moduleSchemas'
import requireModuleWriteScope from '~modules/requireModuleWriteScope'

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
function registerSetDocumentAspects(server: McpServer, context: DocumentsToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Tag a document',
      description:
        "Tags a document of the organization with the aspects of the company it is about, replacing those it had: send every aspect it should keep. Call it when a document is about an aspect it is not tagged with, so it shows on that aspect's page.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      scopeChallenge: requireModuleWriteScope(documentsModule),
    },
    async (args, serverContext) => {
      const prepared = readDocumentsWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toDocumentsWriteResult(await setDocumentAspects(context.caller, args, prepared.call), context.toAddress)
    },
  )
}

export default registerSetDocumentAspects
