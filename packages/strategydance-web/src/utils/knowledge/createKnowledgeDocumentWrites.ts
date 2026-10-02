import { QueryFetchPolicy } from 'firebase/data-connect'
import {
  createDocument,
  discardDocument,
  getDocument,
  renameDocument,
  setDocumentAiLock,
  updateDocumentAspects,
  updateDocumentContent,
} from 'strategydance-database/web'

import type { KnowledgeDocumentWrites } from '~utils/knowledge/createKnowledgeDocumentSaver'

import { dataConnect } from '~data/firebase'

// Part of the message `UpdateDocumentContent`'s check gives when it refuses a save, the document
// being at another revision than the one the save names, or gone: change the two together
const REVISION_REFUSAL = 'changed elsewhere since it was read'

// Part of the message `CreateDocument`'s check gives when the organization keeps as many documents
// as it may: change the two together
const CAPACITY_REFUSAL = 'An organization keeps at most'

// The operations a document's saver sends, bound to the document and its organization
function createKnowledgeDocumentWrites(organizationId: string, documentId: string): KnowledgeDocumentWrites {
  const key = { organizationId, id: documentId }

  return {
    create: async fields => {
      try {
        await createDocument(dataConnect, { ...key, ...fields })

        return 'created'
      } catch (error) {
        if (error instanceof Error && error.message.includes(CAPACITY_REFUSAL)) return 'full'

        throw error
      }
    },
    // From the server, whatever a read before it cached
    read: async () => {
      const { data } = await getDocument(dataConnect, key, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY })
      const stored = data.documents[0]

      if (!stored) return null

      const { title, content, aspects, isAiLocked, revision } = stored

      return { title, content, aspects, isAiLocked, revision }
    },
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
