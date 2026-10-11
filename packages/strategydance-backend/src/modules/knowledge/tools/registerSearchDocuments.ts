import type { McpServer } from '@modelcontextprotocol/server'
import { MAX_SEARCH_QUERY_LENGTH, MAX_SEARCH_TERMS, splitSearchTerms } from 'strategydance-core'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import { MAX_KNOWLEDGE_SEARCH_RESULTS } from '~constants'

import searchKnowledgeDocuments from '~domain/knowledge/searchKnowledgeDocuments'

import { documentSummaryShape } from '~modules/knowledge/knowledgeSchemas'
import toKnowledgeRefusal from '~modules/knowledge/toKnowledgeRefusal'
import { aspectsSchema, hasNoNul } from '~modules/moduleSchemas'
import toToolResult from '~modules/toToolResult'

const inputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(MAX_SEARCH_QUERY_LENGTH)
    .refine(
      query => splitSearchTerms(query).length <= MAX_SEARCH_TERMS,
      `A query holds at most ${MAX_SEARCH_TERMS} words`,
    )
    .refine(hasNoNul, 'A query holds no U+0000')
    .describe('Words every one of which a document holds, in its title or its text, ignoring case'),
  aspects: aspectsSchema.optional().describe('Aspects every one of which a document is tagged with'),
  limit: z
    .int()
    .min(1)
    .max(MAX_KNOWLEDGE_SEARCH_RESULTS)
    .optional()
    .describe('How many documents to answer, 10 at most'),
})

const outputSchema = z.object({
  documents: z.array(z.object({ ...documentSummaryShape, excerpt: z.string() })),
  hasMore: z.boolean(),
  isIndexComplete: z.boolean(),
})

// `search_documents`: the organization's documents agents may read that hold every word of a query
function registerSearchDocuments(server: McpServer, { caller, toAddress }: KnowledgeToolContext) {
  server.registerTool(
    'search_documents',
    {
      title: 'Search knowledge',
      description:
        "Searches the organization's knowledge, the documents its team writes together, for every word of a query, in a document's title or text, ignoring case. Call it to find what the team already decided, planned or noted before answering from memory or writing something new. Answers up to 10 documents with their id, title, aspects, when each last changed, whether you may change it, and an excerpt around a matched word; `hasMore` says more matched, which a narrower query finds. `isIndexComplete` false means some documents were not searchable yet, so try again later or read the ones you know. Read a document with read_document before relying on it.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, aspects, limit }) => {
      const found = await searchKnowledgeDocuments(caller, {
        query,
        aspects: aspects ?? [],
        limit: limit ?? MAX_KNOWLEDGE_SEARCH_RESULTS,
      })

      if (found.outcome !== 'found') return toKnowledgeRefusal(found)

      const documents = await Promise.all(
        found.documents.map(async document => {
          const url = await toAddress(document.id)

          return { ...document, ...(url && { url }) }
        }),
      )

      return toToolResult({ documents, hasMore: found.hasMore, isIndexComplete: found.isIndexComplete })
    },
  )
}

export default registerSearchDocuments
