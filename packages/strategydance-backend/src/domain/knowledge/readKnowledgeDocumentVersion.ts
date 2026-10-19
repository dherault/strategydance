import type { StoredKnowledgeDocumentText } from '~types'

import hashKnowledgeDocumentText from '~domain/knowledge/hashKnowledgeDocumentText'
import openKnowledgeDocumentText from '~domain/knowledge/openKnowledgeDocumentText'
import readKnowledgeDocumentBlocks from '~domain/knowledge/readKnowledgeDocumentBlocks'
import seedKnowledgeDocumentText from '~domain/knowledge/seedKnowledgeDocumentText'

/*
  A document's shared text as it stands, opened for a member: its snapshot with every pending
  update merged, or seeded from its content when it has none, its top-level blocks and the version
  `read_document` would give. Null when it cannot be read, a snapshot that cannot be merged or a
  block this editor lacks
*/
function readKnowledgeDocumentVersion(stored: StoredKnowledgeDocumentText) {
  const opened = openKnowledgeDocumentText({
    state: stored.state ?? seedKnowledgeDocumentText(stored.content),
    updates: stored.updates,
  })

  if (!opened) return null

  const blocks = readKnowledgeDocumentBlocks(opened.doc)

  if (!blocks) return null

  return { ...opened, blocks, version: hashKnowledgeDocumentText(blocks) }
}

export default readKnowledgeDocumentVersion
