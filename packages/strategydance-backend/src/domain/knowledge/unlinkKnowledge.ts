import type { KnowledgeKind } from 'strategydance-core'
import {
  KnowledgeKind as DatabaseKnowledgeKind,
  unlinkKnowledgeDocumentForAgent,
  unlinkKnowledgeMemberForAgent,
  unlinkKnowledgeTaskForAgent,
} from 'strategydance-database/backend'

import type { KnowledgeWriteResult, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import findKnowledgeEntry from '~domain/knowledge/findKnowledgeEntry'
import readKnowledgeLinkTarget, { type KnowledgeLinkReference } from '~domain/knowledge/readKnowledgeLinkTarget'
import toKnowledgeLinkTarget, { type KnowledgeLinkTargetInput } from '~domain/knowledge/toKnowledgeLinkTarget'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

// What unlinking answers: the target, and whether a link was removed, since unlinking what is not
// linked removes nothing
export type KnowledgeUnlink = { kind: KnowledgeKind; id: string; isRemoved: boolean } & KnowledgeLinkReference

type UnlinkKnowledgeInput = { kind: KnowledgeKind; id: string; documentId?: string; taskId?: string; member?: string }

/*
  Unlinks an item from the one document, task or member a call names, held to what a link holds it
  to, so a document kept from AI, which no read shows linked, is neither unlinked. What is not linked
  writes nothing, and says so. The operation removes the one link the read found, so the result kept
  under the call's key holds: a link removed meanwhile refuses it, and it is read again and answered
  from what it finds
*/
async function unlinkKnowledge(
  caller: ModuleCaller,
  { kind, id, ...targets }: UnlinkKnowledgeInput,
  call: ModuleCall | null,
): Promise<KnowledgeWriteResult<KnowledgeUnlink>> {
  const target = toKnowledgeLinkTarget(caller, targets)

  if (!target) return { outcome: 'noTarget' }
  if (!findKnowledgeEntry(kind, id)) return { outcome: 'unknownItem', kind, id }

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const read = await readKnowledgeLinkTarget(caller, kind, id, target)

  if (read.outcome !== 'read') return read

  const result: KnowledgeUnlink = { kind, id, isRemoved: read.isLinked, ...read.reference }

  if (!read.isLinked) return { outcome: 'unchanged', result }

  try {
    await writeUnlink(caller, kind, id, target, toModuleCallVariables(caller, call, result))

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile

    const again = await readKnowledgeLinkTarget(caller, kind, id, target)

    if (again.outcome !== 'read') return again
    if (!again.isLinked) return { outcome: 'unchanged', result: { ...result, isRemoved: false } }

    throw error
  }
}

// The unlink's operation for its kind of target
function writeUnlink(
  caller: ModuleCaller,
  kind: KnowledgeKind,
  itemId: string,
  target: KnowledgeLinkTargetInput,
  callVariables: ReturnType<typeof toModuleCallVariables>,
) {
  const variables = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    kind: DatabaseKnowledgeKind[kind],
    itemId,
    ...callVariables,
  }

  switch (target.target) {
    case 'document':
      return unlinkKnowledgeDocumentForAgent(dataConnect, { ...variables, documentId: target.id })
    case 'task':
      return unlinkKnowledgeTaskForAgent(dataConnect, { ...variables, taskId: target.id })
    case 'member':
      return unlinkKnowledgeMemberForAgent(dataConnect, { ...variables, memberId: target.userId })
  }
}

export default unlinkKnowledge
