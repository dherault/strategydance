import { restoreDocumentForAgent } from 'strategydance-database/backend'

import type { DocumentsWriteResult, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import { FULL_REFUSAL } from '~domain/documents/documentsRefusalMessages'
import readDocumentAccess from '~domain/documents/readDocumentAccess'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

// How long after its delete a document can be restored, as `RestoreDocumentForAgent` holds it
const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000

export type RestoredDocument = {
  id: string
}

/*
  Takes back a delete for an agent, as the page's Undo does: within a day of it, and against the
  1000 documents an organization keeps. Refused unless agents may both read and change it
*/
async function restoreDocument(
  caller: ModuleCaller,
  { id }: { id: string },
  call: ModuleCall | null,
): Promise<DocumentsWriteResult<RestoredDocument>> {
  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const result = { id }

  try {
    await restoreDocumentForAgent(dataConnect, {
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
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
    if (isOperationRefusal(error, FULL_REFUSAL)) return { outcome: 'full' }

    const access = await readDocumentAccess(caller, id)

    if (access.outcome !== 'found') return access
    if (!access.isAiReadable) return { outcome: 'keptFromAi' }
    if (!access.isAiWritable) return { outcome: 'closedToAi' }
    if (access.deletedAt === null) return { outcome: 'notDeleted' }
    if (Date.parse(access.deletedAt) <= Date.now() - RESTORE_WINDOW_MS) return { outcome: 'goneForGood' }

    throw error
  }
}

export default restoreDocument
