import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import readKnowledgeDocument from '~domain/knowledge/readKnowledgeDocument'

import { aspectSchema, documentIdSchema } from '~modules/knowledge/knowledgeSchemas'
import toKnowledgeRefusal from '~modules/knowledge/toKnowledgeRefusal'
import toToolResult from '~modules/toToolResult'

const inputSchema = z.object({
  id: documentIdSchema,
  from: z.string().max(1000).optional().describe('The `next` cursor the previous page gave, to read on from it'),
})

const outputSchema = z.object({
  id: z.string(),
  title: z.string(),
  aspects: z.array(aspectSchema),
  isAiWritable: z.boolean(),
  updatedAt: z.string(),
  version: z.string().optional(),
  blocks: z.array(
    z.object({
      id: z.string(),
      markdown: z.string(),
      offset: z.int().optional(),
      isCut: z.literal(true).optional(),
    }),
  ),
  next: z.string().optional(),
  restart: z.enum(['block', 'document']).optional(),
  url: z.string().optional(),
})

// `read_document`: a document's shared text as its top-level blocks, a page at a time
function registerReadDocument(server: McpServer, { caller, toAddress }: KnowledgeToolContext) {
  server.registerTool(
    'read_document',
    {
      title: 'Read knowledge',
      description:
        "Reads a document of the organization's knowledge as it stands now, with what members are typing merged in: its title, aspects, version, whether you may change it, and its text as a list of top-level blocks, each with its id and its Markdown, up to 40000 characters at a time. Call it before relying on a document or changing it. While more remains it answers `next`: send it back as `from` to read on. A block too long for one page comes in parts, `offset` saying where a part starts and `isCut` that it stops inside the block. `restart` says the page started over, at the block it stopped in when that block was edited, or at the document's start when the block is gone. Edit blocks by their ids with update_document. `version` names the whole text, which replacing all of the content takes: it comes on the last page of a reading, and only when nobody changed the text since its first page, so read the document whole, from the start again if the last page had none, before replacing its content.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, from }) => {
      const read = await readKnowledgeDocument(caller, { id, ...(from !== undefined && { from }) })

      if (read.outcome !== 'read') return toKnowledgeRefusal(read)

      const url = await toAddress(id)

      return toToolResult({ ...read.reading, ...(url && { url }) })
    },
  )
}

export default registerReadDocument
