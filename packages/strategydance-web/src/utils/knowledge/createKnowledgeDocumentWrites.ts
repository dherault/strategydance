import { QueryFetchPolicy } from 'firebase/data-connect'
import {
  createDocument,
  discardDocument,
  getDocument,
  renameDocument,
  setDocumentAiReadable,
  setDocumentAiWritable,
  updateDocumentAspects,
} from 'strategydance-database/web'

import type { KnowledgeDocumentWrites } from '~utils/knowledge/createKnowledgeDocumentSaver'

import { dataConnect } from '~data/firebase'

// Part of the message `CreateDocument`'s check gives when the organization keeps as many documents
// as it may: change the two together
const CAPACITY_REFUSAL = 'An organization keeps at most'

// The operations a document's saver sends, bound to the document, its organization, and the page's
// session, whose own presence does not keep a document it emptied
function createKnowledgeDocumentWrites(
  organizationId: string,
  documentId: string,
  sessionId: string,
): KnowledgeDocumentWrites {
  const key = { organizationId, id: documentId }

  return {
    create: async (fields, state) => {
      try {
        await createDocument(dataConnect, { ...key, ...fields, state })

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

      const { title, content, aspects, isAiReadable, isAiWritable, revision, state } = stored

      return { title, content, aspects, isAiReadable, isAiWritable, revision, state: state ?? null }
    },
    rename: title => renameDocument(dataConnect, { ...key, title }),
    updateAspects: aspects => updateDocumentAspects(dataConnect, { ...key, aspects }),
    setAiReadable: isAiReadable => setDocumentAiReadable(dataConnect, { ...key, isAiReadable }),
    setAiWritable: isAiWritable => setDocumentAiWritable(dataConnect, { ...key, isAiWritable }),
    discard: () => discardDocument(dataConnect, { ...key, sessionId }),
  }
}

export default createKnowledgeDocumentWrites
