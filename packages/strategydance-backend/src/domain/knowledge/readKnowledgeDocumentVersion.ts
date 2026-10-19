import type { StoredKnowledgeDocumentText } from '~types'

import fingerprintKnowledgeDocumentText from '~domain/knowledge/fingerprintKnowledgeDocumentText'
import openKnowledgeDocumentText from '~domain/knowledge/openKnowledgeDocumentText'
import seedKnowledgeDocumentText from '~domain/knowledge/seedKnowledgeDocumentText'

/*
  A document's shared text as it stands, opened for a member: its snapshot with every pending
  update merged, or seeded from its content when it has none, and its fingerprint, which a revision
  compares with the text its edit left. Null when it cannot be read, a snapshot that cannot be
  merged or a block this editor lacks
*/
function readKnowledgeDocumentVersion(stored: StoredKnowledgeDocumentText) {
  const opened = openKnowledgeDocumentText({
    state: stored.state ?? seedKnowledgeDocumentText(stored.content),
    updates: stored.updates,
  })

  if (!opened) return null

  const fingerprint = fingerprintKnowledgeDocumentText(opened.doc)

  if (!fingerprint) return null

  return { ...opened, fingerprint }
}

export default readKnowledgeDocumentVersion
