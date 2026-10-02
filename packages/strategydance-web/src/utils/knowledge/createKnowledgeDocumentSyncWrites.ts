import { QueryFetchPolicy } from 'firebase/data-connect'
import { compactDocument, getDocument, pushDocumentUpdate, seedDocumentState } from 'strategydance-database/web'

import type { KnowledgeDocumentSyncWrites } from '~utils/knowledge/createKnowledgeDocumentSync'

import { dataConnect } from '~data/firebase'

// Part of the message `SeedDocumentState`'s check gives when the document was seeded, or saved, since
// it was read: change the two together
const SEED_REFUSAL = 'seeded or changed elsewhere since it was read'

// Part of the message `PushDocumentUpdate`'s check gives when the document is gone
const GONE_REFUSAL = 'No document by that id in the organization'

// Part of the message `CompactDocument`'s check gives when the snapshot is at another revision, or
// the document is gone
const COMPACTION_REFUSAL = 'compacted or deleted elsewhere since it was read'

function isRefusal(error: unknown, message: string) {
  return error instanceof Error && error.message.includes(message)
}

// The operations a document's sync sends, bound to the document and its organization
function createKnowledgeDocumentSyncWrites(organizationId: string, documentId: string): KnowledgeDocumentSyncWrites {
  const key = { organizationId, id: documentId }

  return {
    // From the server, whatever a read before it cached
    read: async () => {
      const { data } = await getDocument(dataConnect, key, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY })
      const stored = data.documents[0]

      if (!stored) return null

      return {
        state: stored.state ?? null,
        updates: stored.documentUpdates_on_document,
        content: stored.content,
        revision: stored.revision,
      }
    },
    seed: async (state, revision) => {
      try {
        await seedDocumentState(dataConnect, { ...key, state, revision })

        return true
      } catch (error) {
        if (isRefusal(error, SEED_REFUSAL)) return false

        throw error
      }
    },
    push: async (id, payload) => {
      try {
        await pushDocumentUpdate(dataConnect, { organizationId, documentId, id, payload })

        return true
      } catch (error) {
        if (isRefusal(error, GONE_REFUSAL)) return false

        throw error
      }
    },
    compact: async (state, content, revision, updateIds) => {
      try {
        await compactDocument(dataConnect, { ...key, state, content, revision, updateIds })

        return true
      } catch (error) {
        if (isRefusal(error, COMPACTION_REFUSAL)) return false

        throw error
      }
    },
  }
}

export default createKnowledgeDocumentSyncWrites
