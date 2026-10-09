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

// Where the next page starts, and the version the reading's first page read, which its later pages
// answer only while the text is still that version
const cursorSchema = z.object({
  id: z.string().min(1),
  offset: z.int().nonnegative(),
  hash: z.string().optional(),
  version: z.string().min(1),
})

export type KnowledgeDocumentReading = {
  id: string
  title: string
  aspects: CompanyAspect[]
  isAiWritable: boolean
  updatedAt: string
  // The version of the whole text, on the last page of a reading whose text did not change since
  // its first page
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
  agent saw all of that text. A reading starts from one version, which its cursor carries, and only
  its last page answers it, and only while the text is still that version: no page before the end,
  and none once somebody changed the text, so an agent never holds a version of text it did not
  read whole. A reading started again from the start takes the version then
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
  const version = hashKnowledgeDocumentText(read.blocks)
  // A page that starts the document, the first or one started again, starts a reading of its own
  const readingVersion = cursor && page.restart !== 'document' ? cursor.version : version

  return {
    outcome: 'read',
    reading: {
      id,
      title,
      aspects,
      isAiWritable,
      updatedAt,
      ...(!page.next && readingVersion === version && { version }),
      blocks: page.blocks,
      ...(page.next && { next: encodeCursor({ ...page.next, version: readingVersion }) }),
      ...(page.restart && { restart: page.restart }),
    },
  }
}

export default readKnowledgeDocument
