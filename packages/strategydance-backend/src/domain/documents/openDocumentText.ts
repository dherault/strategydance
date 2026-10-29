import * as Y from 'yjs'

import type { SeededDocumentText } from '~types'

import logger from '~utils/logger'

/*
  A document's shared text as a Yjs document: its snapshot with every pending update merged, as an
  open editor holds it, and the ids of the updates merged, which a fold deletes. An update that
  cannot be merged is skipped and listed all the same, as the page skips it and its next fold
  deletes it. Null when the snapshot cannot be merged, which nothing may fold over, since it is the
  only stored copy of the text
*/
function openDocumentText({ state, updates }: SeededDocumentText) {
  const doc = new Y.Doc()

  try {
    Y.applyUpdate(doc, Buffer.from(state, 'base64'))
  } catch (error) {
    logger.error('Documents: a document snapshot could not be merged', error)

    return null
  }

  for (const { id, payload } of updates) {
    try {
      Y.applyUpdate(doc, Buffer.from(payload, 'base64'))
    } catch (error) {
      logger.warn(`Documents: skipped the document update ${id}, which could not be merged: ${String(error)}`)
    }
  }

  return { doc, updateIds: updates.map(({ id }) => id) }
}

export default openDocumentText
