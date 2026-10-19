import { gunzipSync } from 'node:zlib'

import * as Y from 'yjs'

import logger from '~utils/logger'

// A revision's text as a Yjs document, the snapshot it keeps decompressed and merged, or null when that cannot be
function openKnowledgeDocumentRevision(compressedState: string) {
  const doc = new Y.Doc()

  try {
    Y.applyUpdate(doc, gunzipSync(Buffer.from(compressedState, 'base64')))
  } catch (error) {
    logger.error('Knowledge: a document revision could not be opened', error)

    return null
  }

  return doc
}

export default openKnowledgeDocumentRevision
