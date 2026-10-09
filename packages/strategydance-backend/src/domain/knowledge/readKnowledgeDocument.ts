import type { CompanyAspect } from 'strategydance-database/backend'
import { z } from 'zod'

import type { KnowledgeRefusal, ModuleCaller } from '~types'

import decodeCursor from '~utils/decodeCursor'
import encodeCursor from '~utils/encodeCursor'

import hashKnowledgeDocumentText from '~domain/knowledge/hashKnowledgeDocumentText'
import loadKnowledgeDocument from '~domain/knowledge/loadKnowledgeDocument'
import paginateKnowledgeDocumentBlocks, {
  type KnowledgeDocumentPageBlock,
} from '~domain/knowledge/paginateKnowledgeDocumentBlocks'
import readKnowledgeDocumentText from '~domain/knowledge/readKnowledgeDocumentText'

// Where the next page starts
const cursorSchema = z.object({
  id: z.string().min(1),
  offset: z.int().nonnegative(),
  hash: z.string().optional(),
})

export type KnowledgeDocumentReading = {
  id: string
  title: string
  aspects: CompanyAspect[]
  isAiWritable: boolean
  updatedAt: string
  // The version of the whole text, on a page that holds all of it
  version?: string
  blocks: KnowledgeDocumentPageBlock[]
  // Where the next page starts, while more remains
  next?: string
  restart?: 'block' | 'document'
}

type ReadKnowledgeDocumentResult = { outcome: 'read'; reading: KnowledgeDocumentReading } | KnowledgeRefusal

/*
  A page of a document's shared text, as an agent reads it: its snapshot with every pending update
  merged, never `content`, which lags until the next compaction, as its top-level blocks, each with
  the id it keeps while others are typed around it and its Markdown, from where `from` says. Refused,
  before anything of the document is loaded, when the team keeps it from agents.

  Its version is a hash of the whole text, which a whole text replaced has to name, so it says the
  agent saw all of that text: only a page that holds the whole document answers it, from its first
  block to its last, as a document small enough to read whole is the one whose content an agent
  replaces. A longer one is edited by its blocks. Whatever a cursor says, a page holding everything
  was read whole, so nothing an agent sends earns a version of text it did not see
*/
async function readKnowledgeDocument(
  caller: ModuleCaller,
  { id, from }: { id: string; from?: string },
): Promise<ReadKnowledgeDocumentResult> {
  const cursor = from === undefined ? null : decodeCursor(from, cursorSchema)

  if (from !== undefined && !cursor) return { outcome: 'invalidCursor' }

  const loaded = await loadKnowledgeDocument(caller, id)

  if (loaded.outcome !== 'loaded') return loaded

  const read = readKnowledgeDocumentText(loaded.document.text)

  if (read.outcome !== 'read') return { outcome: 'unreadable' }

  const page = paginateKnowledgeDocumentBlocks(read.blocks, cursor)
  const { title, aspects, isAiWritable, updatedAt } = loaded.document
  const [first] = page.blocks
  const isWhole = !page.next && (read.blocks.length === 0 || (first?.id === read.blocks[0]?.id && !first?.offset))

  return {
    outcome: 'read',
    reading: {
      id,
      title,
      aspects,
      isAiWritable,
      updatedAt,
      ...(isWhole && { version: hashKnowledgeDocumentText(read.blocks) }),
      blocks: page.blocks,
      ...(page.next && { next: encodeCursor(page.next) }),
      ...(page.restart && { restart: page.restart }),
    },
  }
}

export default readKnowledgeDocument
