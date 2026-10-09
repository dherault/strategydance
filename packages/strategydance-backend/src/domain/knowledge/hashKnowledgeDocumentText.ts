import { createHash } from 'node:crypto'

import type { KnowledgeDocumentBlock } from '~types'

// How many hex digits of the SHA-256 a version keeps: enough that two texts never share one
const VERSION_LENGTH = 24

/*
  A document's version, as `read_document` gives it and a whole text replaced has to name: a hash
  of every top-level block's id and Markdown, so any change to the text, or a block replaced by one
  that reads the same, moves it
*/
function hashKnowledgeDocumentText(blocks: readonly KnowledgeDocumentBlock[]) {
  return createHash('sha256')
    .update(JSON.stringify(blocks.map(({ id, markdown }) => [id, markdown])))
    .digest('hex')
    .slice(0, VERSION_LENGTH)
}

export default hashKnowledgeDocumentText
