import * as Y from 'yjs'

import logger from '~utils/logger'

// A revision's text as a Yjs document, the snapshot it keeps merged, or null when that cannot be
function openKnowledgeDocumentRevision(state: string) {
  const doc = new Y.Doc()

  try {
    Y.applyUpdate(doc, Buffer.from(state, 'base64'))
  } catch (error) {
    logger.error('Knowledge: a document revision could not be merged', error)

    return null
  }

  return doc
}

export default openKnowledgeDocumentRevision
