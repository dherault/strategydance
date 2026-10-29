import type { DocumentBlock, SeededDocumentText } from '~types'

import openDocumentText from '~domain/documents/openDocumentText'
import readDocumentBlocks from '~domain/documents/readDocumentBlocks'

type ReadDocumentTextResult =
  | { outcome: 'read'; blocks: DocumentBlock[] }
  /** The snapshot cannot be merged */
  | { outcome: 'unreadableState' }
  /** The text holds what this editor cannot read, a newer editor's block say, which a read would delete */
  | { outcome: 'unknownContent' }

/*
  A seeded document's shared text, as an agent reads it: its snapshot with every pending update
  merged, never `content`, which lags until the next compaction, as top-level blocks, each with
  the id the shared text keeps it under and its Markdown
*/
function readDocumentText(text: SeededDocumentText): ReadDocumentTextResult {
  const opened = openDocumentText(text)

  if (!opened) return { outcome: 'unreadableState' }

  const blocks = readDocumentBlocks(opened.doc)

  if (!blocks) return { outcome: 'unknownContent' }

  return { outcome: 'read', blocks }
}

export default readDocumentText
