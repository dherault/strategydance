import { getUnindexedDocumentsForAgent, indexDocumentTextForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { MAX_KNOWLEDGE_DOCUMENTS_INDEXED } from '~constants'

import { dataConnect } from '~firebase'

import readKnowledgeDocumentContentText from '~domain/knowledge/readKnowledgeDocumentContentText'

type IndexKnowledgeDocumentsResult = { outcome: 'notMember' } | { outcome: 'indexed'; isComplete: boolean }

/*
  Indexes, before a search reads the index, up to 20 documents agents may read whose plain text a
  page from before `contentText` left null, from their `content`, enough for the odd fold from an old
  bundle once the release's backfill has run. Each is written only at the revision read, so a fold
  landing in between, which writes its own text or nulls it again, is never written over: that one
  stays for the next search. The answer says whether every document is indexed now, which the
  search's answer passes on, and refuses a caller who is no longer the member the module read
*/
async function indexKnowledgeDocuments(caller: ModuleCaller): Promise<IndexKnowledgeDocumentsResult> {
  const reference = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
  }
  const { data } = await getUnindexedDocumentsForAgent(dataConnect, reference)

  if (data.membership.length === 0) return { outcome: 'notMember' }

  const batch = data.documents.slice(0, MAX_KNOWLEDGE_DOCUMENTS_INDEXED)
  const written = await Promise.all(
    batch.map(async document => {
      const { data: indexed } = await indexDocumentTextForAgent(dataConnect, {
        ...reference,
        id: document.id,
        revision: document.revision,
        contentText: readKnowledgeDocumentContentText(document.content),
      })

      return indexed.document_updateMany === 1
    }),
  )

  return {
    outcome: 'indexed',
    isComplete: data.documents.length <= MAX_KNOWLEDGE_DOCUMENTS_INDEXED && written.every(Boolean),
  }
}

export default indexKnowledgeDocuments
