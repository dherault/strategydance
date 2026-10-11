import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import listKnowledgeDocuments from '~domain/knowledge/listKnowledgeDocuments'

import { documentSummaryShape } from '~modules/knowledge/knowledgeSchemas'
import toKnowledgeRefusal from '~modules/knowledge/toKnowledgeRefusal'
import { aspectsSchema } from '~modules/moduleSchemas'
import toToolResult from '~modules/toToolResult'

const inputSchema = z.object({
  aspects: aspectsSchema.optional().describe('Aspects every one of which a document is tagged with'),
  cursor: z.string().max(1000).optional().describe('The cursor the previous page gave, to read the next one'),
})

const outputSchema = z.object({
  documents: z.array(z.object(documentSummaryShape)),
  cursor: z.string().optional(),
})

// `list_documents`: the organization's documents agents may read, a page at a time
function registerListDocuments(server: McpServer, { caller, toAddress }: KnowledgeToolContext) {
  server.registerTool(
    'list_documents',
    {
      title: 'List knowledge',
      description:
        "Lists the organization's knowledge, the documents its team writes together, 50 at a time, latest changed first, with each one's id, title, aspects, when it last changed and whether you may change it. Call it to look round when you do not know what to search for, or to see what the team keeps about an aspect. Answers a `cursor` while more remain: send it back to read the next page.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ aspects, cursor }) => {
      const listed = await listKnowledgeDocuments(caller, {
        aspects: aspects ?? [],
        ...(cursor !== undefined && { cursor }),
      })

      if (listed.outcome !== 'listed') return toKnowledgeRefusal(listed)

      const documents = await Promise.all(
        listed.documents.map(async document => {
          const url = await toAddress(document.id)

          return { ...document, ...(url && { url }) }
        }),
      )

      return toToolResult({ documents, ...(listed.cursor && { cursor: listed.cursor }) })
    },
  )
}

export default registerListDocuments
