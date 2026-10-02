import {
  createDocument,
  discardDocument,
  renameDocument,
  setDocumentAiLock,
  updateDocumentAspects,
  updateDocumentContent,
} from 'strategydance-database/web'

import type { KnowledgeDocumentWrites } from '~utils/knowledge/createKnowledgeDocumentSaver'

import { dataConnect } from '~data/firebase'

// Part of the message `UpdateDocumentContent`'s check refuses a save with when the document is not
// at the revision it names any more, or is gone: change the two together
const REVISION_REFUSAL = 'changed elsewhere since it was read'

// The operations a document's saver sends, bound to the document and its organization
function createKnowledgeDocumentWrites(organizationId: string, documentId: string): KnowledgeDocumentWrites {
  const key = { organizationId, id: documentId }

  return {
    create: fields => createDocument(dataConnect, { ...key, ...fields }),
    rename: title => renameDocument(dataConnect, { ...key, title }),
    updateContent: async (content, revision) => {
      try {
        await updateDocumentContent(dataConnect, { ...key, content, revision })

        return true
      } catch (error) {
        if (error instanceof Error && error.message.includes(REVISION_REFUSAL)) return false

        throw error
      }
    },
    updateAspects: aspects => updateDocumentAspects(dataConnect, { ...key, aspects }),
    setAiLock: isAiLocked => setDocumentAiLock(dataConnect, { ...key, isAiLocked }),
    discard: () => discardDocument(dataConnect, key),
  }
}

export default createKnowledgeDocumentWrites
