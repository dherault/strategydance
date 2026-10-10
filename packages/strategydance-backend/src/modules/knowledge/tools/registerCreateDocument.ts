import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import createKnowledgeDocument from '~domain/knowledge/createKnowledgeDocument'

import { markdownSchema, titleSchema } from '~modules/knowledge/knowledgeSchemas'
import readKnowledgeWriteCall from '~modules/knowledge/readKnowledgeWriteCall'
import toKnowledgeWriteResult from '~modules/knowledge/toKnowledgeWriteResult'
import { aspectSchema, aspectsSchema } from '~modules/moduleSchemas'

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

// `create_document`: a new document in the organization's knowledge
function registerCreateDocument(server: McpServer, context: KnowledgeToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Create knowledge',
      description:
        "Creates a document in the organization's knowledge, with its title, its aspects and its text in Markdown. Call it to write down a decision, a plan or notes the member agreed to keep, once a search found no document it belongs in. The team shares it at once, and you may read and change it, as they may turn off. Answers its id and version.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readKnowledgeWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toKnowledgeWriteResult(
        await createKnowledgeDocument(context.caller, args, prepared.call),
        context.toAddress,
      )
    },
  )
}

export default registerCreateDocument
