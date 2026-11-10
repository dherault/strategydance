import { type DirectoryStatus, isDirectoryStatusInUse } from 'strategydance-core'
import { DirectoryStatus as DatabaseDirectoryStatus, setDirectoryStatusForAgent } from 'strategydance-database/backend'

import type { KnowledgeWriteResult, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import findKnowledgeEntry from '~domain/knowledge/findKnowledgeEntry'
import readKnowledgeState, { type KnowledgeUse } from '~domain/knowledge/readKnowledgeState'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

// A directory's status as the tool takes it: one of the statuses, or back to do
export type DirectoryStatusInput = DirectoryStatus | 'TO_DO'

// What setting a directory's status answers: its use as it stands, null for one never marked
export type SetDirectoryStatusAnswer = {
  id: string
  use: KnowledgeUse
}

/*
  Sets where the organization stands with a directory, for the member the agent acts as, `inUse`
  following it, true exactly while it is submitted or listed. The id is held to the release's
  catalogue first, inactive directories included, since the operation cannot read it. The status it
  holds already, or to do for one never marked, writes nothing, so `changedAt` keeps the day it last
  changed and a directory never tried is not told as one taken back. A change answers the time the
  module wrote it, the row taking the database's own a moment later
*/
async function setDirectoryStatus(
  caller: ModuleCaller,
  { id, status }: { id: string; status: DirectoryStatusInput },
  call: ModuleCall | null,
): Promise<KnowledgeWriteResult<SetDirectoryStatusAnswer>> {
  if (!findKnowledgeEntry('DIRECTORY', id)) return { outcome: 'unknownItem', kind: 'DIRECTORY', id }

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const read = await readKnowledgeState(caller, 'DIRECTORY', [id])

  if (read.outcome !== 'read') return read

  const { use } = read.states.get(id)!
  const directoryStatus = status === 'TO_DO' ? null : status

  if ((use?.status ?? null) === directoryStatus) return { outcome: 'unchanged', result: { id, use } }

  const isInUse = isDirectoryStatusInUse(directoryStatus)
  const result: SetDirectoryStatusAnswer = {
    id,
    use: { inUse: isInUse, changedAt: new Date().toISOString(), status: directoryStatus },
  }

  try {
    await setDirectoryStatusForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      itemId: id,
      directoryStatus: directoryStatus && DatabaseDirectoryStatus[directoryStatus],
      isInUse,
      ...toModuleCallVariables(caller, call, result),
    })

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }

    throw error
  }
}

export default setDirectoryStatus
