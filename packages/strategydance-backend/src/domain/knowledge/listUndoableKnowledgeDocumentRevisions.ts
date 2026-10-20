import { getConversationDocumentRevisions, getDocumentTextForMember } from 'strategydance-database/backend'

import { MAX_UNDOABLE_REVISION_DOCUMENTS } from '~constants'

import { dataConnect } from '~firebase'

import toConversationModuleScope from '~domain/agent/toConversationModuleScope'
import readKnowledgeDocumentVersion from '~domain/knowledge/readKnowledgeDocumentVersion'

type ListUndoableKnowledgeDocumentRevisionsInput = {
  organizationId: string
  userId: string
  conversationId: string
}

// An agent's edit a member can undo from its tool call's row: the revision it kept, found by the call's key
export type UndoableKnowledgeDocumentRevision = {
  id: string
  callKey: string
  documentId: string
}

/*
  The edits a conversation's agent made to documents, as its member made them, that an Undo can
  still take back: those whose document's text is still exactly what the edit left, by its
  fingerprint, so nobody has written to it since. The thread offers Undo on their rows, and the
  restore checks again.

  The text is read as it stands, every pending update merged, for the documents of the newest
  edits first, 20 at most, a read each, since only the newest edit of a document can be still what
  it left. A document deleted, or one that cannot be read here, offers none
*/
async function listUndoableKnowledgeDocumentRevisions({
  organizationId,
  userId,
  conversationId,
}: ListUndoableKnowledgeDocumentRevisionsInput): Promise<UndoableKnowledgeDocumentRevision[]> {
  const { data } = await getConversationDocumentRevisions(dataConnect, {
    organizationId,
    userId,
    scope: toConversationModuleScope(conversationId),
  })
  const documentIds = [...new Set(data.documentRevisions.map(revision => revision.documentId))].slice(
    0,
    MAX_UNDOABLE_REVISION_DOCUMENTS,
  )
  const texts = await Promise.all(
    documentIds.map(id => getDocumentTextForMember(dataConnect, { organizationId, userId, id })),
  )
  const versions = new Map<string, string>()

  texts.forEach(({ data: { documents } }, index) => {
    const [row] = documents
    const current = row
      ? readKnowledgeDocumentVersion({
          state: row.state ?? null,
          updates: row.documentUpdates_on_document,
          content: row.content,
        })
      : null

    if (current) versions.set(documentIds[index], current.fingerprint)
  })

  return data.documentRevisions.flatMap(({ id, callKey, documentId, afterFingerprint }) =>
    callKey && versions.get(documentId) === afterFingerprint ? [{ id, callKey, documentId }] : [],
  )
}

export default listUndoableKnowledgeDocumentRevisions
