import type { KnowledgeKind } from 'strategydance-core'
import { KnowledgeKind as DatabaseKnowledgeKind, setKnowledgeInUseForAgent } from 'strategydance-database/backend'

import type { KnowledgeWriteResult, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import findKnowledgeEntry from '~domain/knowledge/findKnowledgeEntry'
import readKnowledgeState, { type KnowledgeUse } from '~domain/knowledge/readKnowledgeState'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

// What marking an item answers: its use as it stands, null for one never marked
export type SetKnowledgeUse = {
  kind: KnowledgeKind
  id: string
  use: KnowledgeUse
}

/*
  Marks an item in use, or no longer, for the member the agent acts as. The id is held to the
  release's catalogue first, inactive directories included, since the operation cannot read it. The
  flag the item holds already, or false for one never marked, writes nothing, so `changedAt` keeps
  the day the flag last changed and an item never tried is not told as one dropped. A change answers
  the time the module wrote it, the row taking the database's own a moment later
*/
async function setKnowledgeInUse(
  caller: ModuleCaller,
  { kind, id, inUse }: { kind: KnowledgeKind; id: string; inUse: boolean },
  call: ModuleCall | null,
): Promise<KnowledgeWriteResult<SetKnowledgeUse>> {
  if (!findKnowledgeEntry(kind, id)) return { outcome: 'unknownItem', kind, id }

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const read = await readKnowledgeState(caller, kind, [id])

  if (read.outcome !== 'read') return read

  const { use } = read.states.get(id)!

  if ((use?.inUse ?? false) === inUse) return { outcome: 'unchanged', result: { kind, id, use } }

  const result: SetKnowledgeUse = { kind, id, use: { inUse, changedAt: new Date().toISOString() } }

  try {
    await setKnowledgeInUseForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      kind: DatabaseKnowledgeKind[kind],
      itemId: id,
      isInUse: inUse,
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

export default setKnowledgeInUse
