import type { StoredDocumentText } from '~types'

import fingerprintDocumentText from '~domain/documents/fingerprintDocumentText'
import openDocumentText from '~domain/documents/openDocumentText'
import seedDocumentText from '~domain/documents/seedDocumentText'

/*
  A document's shared text as it stands, opened for a member: its snapshot with every pending
  update merged, or seeded from its content when it has none, and its fingerprint, which a revision
  compares with the text its edit left. Null when it cannot be read, a snapshot that cannot be
  merged or a block this editor lacks
*/
function readDocumentVersion(stored: StoredDocumentText) {
  const opened = openDocumentText({
    state: stored.state ?? seedDocumentText(stored.content),
    updates: stored.updates,
  })

  if (!opened) return null

  const fingerprint = fingerprintDocumentText(opened.doc)

  if (!fingerprint) return null

  return { ...opened, fingerprint }
}

export default readDocumentVersion
