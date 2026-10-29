import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { DocumentsToolContext } from '~types'

import createDocument from '~domain/documents/createDocument'

import documentsModule from '~modules/documents/documentsModule'
import { markdownSchema, titleSchema } from '~modules/documents/documentsSchemas'
import readDocumentsWriteCall from '~modules/documents/readDocumentsWriteCall'
import toDocumentsWriteResult from '~modules/documents/toDocumentsWriteResult'
import { aspectSchema, aspectsSchema } from '~modules/moduleSchemas'
import requireModuleWriteScope from '~modules/requireModuleWriteScope'

const TOOL = 'create_document'

const inputSchema = z.object({
  title: titleSchema.describe("The document's title, one line"),
  aspects: aspectsSchema.describe('The aspects of the company it is about, each at most once'),
  content: markdownSchema.describe('Its text, in Markdown'),
})

const outputSchema = z.object({
  id: z.string(),
  title: z.string(),
  aspects: z.array(aspectSchema),
  version: z.string(),
  url: z.string().optional(),
})

// `create_document`: a new document of the organization
function registerCreateDocument(server: McpServer, context: DocumentsToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Create a document',
      description:
        'Creates a document of the organization, with its title, its aspects and its text in Markdown, where a [title](doc:<id>) or [name](task:<id>) link mentions a document or a task. Call it to write down a decision, a plan or notes the member agreed to keep, once a search found no document it belongs in. The team shares it at once, and you may read and change it, as they may turn off. Answers its id and version.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      scopeChallenge: requireModuleWriteScope(documentsModule),
    },
    async (args, serverContext) => {
      const prepared = readDocumentsWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toDocumentsWriteResult(await createDocument(context.caller, args, prepared.call), context.toAddress)
    },
  )
}

export default registerCreateDocument
