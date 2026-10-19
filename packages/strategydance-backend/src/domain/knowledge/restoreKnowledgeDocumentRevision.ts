import { getDocumentRevisionForMember, restoreDocumentRevision } from 'strategydance-database/backend'
import { updateRichTextYDoc } from 'strategydance-design-system/lib/updateRichTextYDoc'
import * as Y from 'yjs'

import { KNOWLEDGE_FOLD_ATTEMPTS, MAX_DOCUMENT_REVISION_MARKDOWN_LENGTH } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import compressKnowledgeDocumentRevisionState from '~domain/knowledge/compressKnowledgeDocumentRevisionState'
import hashKnowledgeDocumentText from '~domain/knowledge/hashKnowledgeDocumentText'
import isKnowledgeWriteTooLarge from '~domain/knowledge/isKnowledgeWriteTooLarge'
import { EDITED_REFUSAL, EMPTY_REFUSAL, RESTORE_FOLDED_REFUSAL } from '~domain/knowledge/knowledgeRefusalMessages'
import measureKnowledgeDocumentText from '~domain/knowledge/measureKnowledgeDocumentText'
import openKnowledgeDocumentRevision from '~domain/knowledge/openKnowledgeDocumentRevision'
import readKnowledgeDocumentBlocks from '~domain/knowledge/readKnowledgeDocumentBlocks'
import readKnowledgeDocumentVersion from '~domain/knowledge/readKnowledgeDocumentVersion'
import toKnowledgeDocumentMarkdown from '~domain/knowledge/toKnowledgeDocumentMarkdown'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'

type RestoreKnowledgeDocumentRevisionInput = {
  organizationId: string
  userId: string
  documentId: string
  revisionId: string
  // An Undo from a tool call's row, which goes back only while nobody has written since the edit
  isUndo: boolean
}

export type RestoreKnowledgeDocumentRevisionResult =
  /** Written back, as a new edit kept as a revision of its own, under this id */
  | { outcome: 'restored'; revisionId: string }
  /** The text reads as the version already, so nothing was written */
  | { outcome: 'unchanged' }
  /** The revision, or its document, is gone: pruned, deleted, or never this organization's */
  | { outcome: 'notFound' }
  /** An Undo once somebody wrote to the document since the edit */
  | { outcome: 'changed' }
  /** The version cannot be written back as the document stands: too long, or not readable here */
  | { outcome: 'unrestorable' }

/*
  A member going back to a version of a document: the text it held before an agent's edit, or
  before a restore, written back as a new edit on the shared text as it stands, as a difference
  through `updateRichTextYDoc`, so every block the two share keeps whatever is typed in it
  meanwhile. The text it replaces is kept as a revision of its own, whose id it answers, so the
  restore can be undone in turn.

  An Undo goes back only while the text is still the version the edit left, which the mutation
  holds once the row is locked too, no update pending beyond those merged; a restore from the
  history takes what was written since with it, as the member was told. The member is never held to
  what the team lets agents do. As an agent's edit, it is stored under the revision read, and read
  again and applied again when somebody folded meanwhile, three times at most
*/
async function restoreKnowledgeDocumentRevision({
  organizationId,
  userId,
  documentId,
  revisionId,
  isUndo,
}: RestoreKnowledgeDocumentRevisionInput): Promise<RestoreKnowledgeDocumentRevisionResult> {
  for (let attempt = 0; attempt < KNOWLEDGE_FOLD_ATTEMPTS; attempt++) {
    const { data } = await getDocumentRevisionForMember(dataConnect, {
      organizationId,
      userId,
      documentId,
      revisionId,
    })
    const [row] = data.documentRevisions

    if (!row) return { outcome: 'notFound' }

    const { document } = row
    const current = readKnowledgeDocumentVersion({
      state: document.state ?? null,
      updates: document.documentUpdates_on_document,
      content: document.content,
    })

    if (!current) return { outcome: 'unrestorable' }
    if (isUndo && current.version !== row.afterVersion) return { outcome: 'changed' }

    const source = openKnowledgeDocumentRevision(row.compressedState)

    if (!source) return { outcome: 'unrestorable' }

    const previousState = Buffer.from(Y.encodeStateAsUpdate(current.doc)).toString('base64')

    if (updateRichTextYDoc(current.doc, { type: 'restore', source }).outcome !== 'updated') {
      return { outcome: 'unrestorable' }
    }

    const measured = measureKnowledgeDocumentText(current.doc)
    const restored = readKnowledgeDocumentBlocks(current.doc)

    if (measured.outcome !== 'measured' || !restored) return { outcome: 'unrestorable' }

    const afterVersion = hashKnowledgeDocumentText(restored)

    if (afterVersion === current.version) return { outcome: 'unchanged' }

    const restoreId = toCanonicalUuid(crypto.randomUUID())
    const variables = {
      organizationId,
      userId,
      id: documentId,
      revision: document.revision,
      state: measured.state,
      content: measured.content,
      contentText: measured.contentText,
      updateIds: current.updateIds,
      isUndo,
      revisionId: restoreId,
      revisionCompressedState: compressKnowledgeDocumentRevisionState(previousState),
      revisionMarkdown: toKnowledgeDocumentMarkdown(current.blocks).slice(0, MAX_DOCUMENT_REVISION_MARKDOWN_LENGTH),
      revisionAfterVersion: afterVersion,
      restoredVersionAt: row.createdAt,
    }

    if (isKnowledgeWriteTooLarge(variables)) return { outcome: 'unrestorable' }

    try {
      await restoreDocumentRevision(dataConnect, variables)

      return { outcome: 'restored', revisionId: restoreId }
    } catch (error) {
      if (isOperationRefusal(error, RESTORE_FOLDED_REFUSAL)) continue
      // First, as the checks nested under the membership are named aborted in the same message
      if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notFound' }
      // Somebody typed between the read and the write, which an Undo does not go back over
      if (isOperationRefusal(error, EDITED_REFUSAL)) return { outcome: 'changed' }
      // An empty version of a document whose title went blank since
      if (isOperationRefusal(error, EMPTY_REFUSAL)) return { outcome: 'unrestorable' }

      throw error
    }
  }

  return { outcome: isUndo ? 'changed' : 'unrestorable' }
}

export default restoreKnowledgeDocumentRevision
