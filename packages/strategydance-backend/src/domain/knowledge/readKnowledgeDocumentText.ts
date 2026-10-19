import type { KnowledgeDocumentBlock, SeededKnowledgeDocumentText } from '~types'

import openKnowledgeDocumentText from '~domain/knowledge/openKnowledgeDocumentText'
import readKnowledgeDocumentBlocks from '~domain/knowledge/readKnowledgeDocumentBlocks'

type ReadKnowledgeDocumentTextResult =
  | { outcome: 'read'; blocks: KnowledgeDocumentBlock[] }
  /** The snapshot cannot be merged */
  | { outcome: 'unreadableState' }
  /** The text holds what this editor cannot read, a newer editor's block say, which a read would delete */
  | { outcome: 'unknownContent' }

/*
  A seeded document's shared text, as an agent reads it: its snapshot with every pending update
  merged, never `content`, which lags until the next compaction, as top-level blocks, each with
  the id the shared text keeps it under and its Markdown
*/
function readKnowledgeDocumentText(text: SeededKnowledgeDocumentText): ReadKnowledgeDocumentTextResult {
  const opened = openKnowledgeDocumentText(text)

  if (!opened) return { outcome: 'unreadableState' }

  const blocks = readKnowledgeDocumentBlocks(opened.doc)

  if (!blocks) return { outcome: 'unknownContent' }

  return { outcome: 'read', blocks }
}

export default readKnowledgeDocumentText
