import { deleteDocumentForAgent } from 'strategydance-database/backend'

import type { KnowledgeWriteResult, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import explainKnowledgeDocumentRefusal from '~domain/knowledge/explainKnowledgeDocumentRefusal'
import isKnowledgeRefusal from '~domain/knowledge/isKnowledgeRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/knowledge/knowledgeRefusalMessages'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

// How long a deleted document can be restored, as its page's Undo and the sweep hold it
const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000

// What deleting answers: the document, and until when `restore_document` brings it back
export type DeletedKnowledgeDocument = {
  id: string
  restorableUntil: string
}

/*
  Deletes a document for an agent as its page's Delete does, setting `deletedAt`, so it can be
  restored for a day, which the answer says. Refused unless agents may both read and change it, so
  an agent never deletes what it could not read
*/
async function deleteKnowledgeDocument(
  caller: ModuleCaller,
  { id }: { id: string },
  call: ModuleCall | null,
): Promise<KnowledgeWriteResult<DeletedKnowledgeDocument>> {
  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const result = { id, restorableUntil: new Date(Date.now() + RESTORE_WINDOW_MS).toISOString() }

  try {
    await deleteDocumentForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      id,
      ...toModuleCallVariables(caller, call, result),
    })

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isKnowledgeRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }

    const refusal = await explainKnowledgeDocumentRefusal(caller, id, { isWrite: true })

    if (refusal) return refusal

    throw error
  }
}

export default deleteKnowledgeDocument
