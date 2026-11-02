import type { KnowledgeKind } from 'strategydance-core'
import {
  KnowledgeKind as DatabaseKnowledgeKind,
  linkKnowledgeDocumentForAgent,
  linkKnowledgeMemberForAgent,
  linkKnowledgeTaskForAgent,
} from 'strategydance-database/backend'

import type { KnowledgeWriteResult, ModuleCall, ModuleCaller } from '~types'

import { MAX_KNOWLEDGE_LINKS } from '~constants'

import { dataConnect } from '~firebase'

import findKnowledgeEntry from '~domain/knowledge/findKnowledgeEntry'
import readKnowledgeLinkTarget, { type KnowledgeLinkReference } from '~domain/knowledge/readKnowledgeLinkTarget'
import toKnowledgeLinkTarget, { type KnowledgeLinkTargetInput } from '~domain/knowledge/toKnowledgeLinkTarget'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

// What linking answers: the link with its target, and whether it is new, since one there already
// changes nothing
export type KnowledgeLink = { kind: KnowledgeKind; id: string; isNew: boolean } & KnowledgeLinkReference

type LinkKnowledgeInput = { kind: KnowledgeKind; id: string; documentId?: string; taskId?: string; member?: string }

/*
  Links an item to the one document, task or member a call names: a document the agent may read, a
  live task, a member of the organization. The id is held to the release's catalogue first, since
  the operation cannot read it, and the target is read before the write, since the result kept under
  the call's key is written with the link. A link there already writes nothing, and a new one is
  refused past the 100 targets of its kind an item links (`MAX_KNOWLEDGE_LINKS`), which the operation
  counts again under the organization's lock. A write refused for what changed since the read, a
  foreign key reported before any check, is read again and answered from what it finds
*/
async function linkKnowledge(
  caller: ModuleCaller,
  { kind, id, ...targets }: LinkKnowledgeInput,
  call: ModuleCall | null,
): Promise<KnowledgeWriteResult<KnowledgeLink>> {
  const target = toKnowledgeLinkTarget(caller, targets)

  if (!target) return { outcome: 'noTarget' }
  if (!findKnowledgeEntry(kind, id)) return { outcome: 'unknownItem', kind, id }

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const read = await readKnowledgeLinkTarget(caller, kind, id, target)

  if (read.outcome !== 'read') return read

  const result: KnowledgeLink = { kind, id, isNew: !read.isLinked, ...read.reference }

  if (read.isLinked) return { outcome: 'unchanged', result }
  if (read.linkCount >= MAX_KNOWLEDGE_LINKS) return { outcome: 'tooManyLinks', target: target.target }

  try {
    await writeLink(caller, kind, id, target, toModuleCallVariables(caller, call, result))

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile

    const again = await readKnowledgeLinkTarget(caller, kind, id, target)

    if (again.outcome !== 'read') return again
    if (again.isLinked) return { outcome: 'unchanged', result: { ...result, isNew: false } }
    if (again.linkCount >= MAX_KNOWLEDGE_LINKS) return { outcome: 'tooManyLinks', target: target.target }

    throw error
  }
}

// The link's operation for its kind of target
function writeLink(
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
      return linkKnowledgeDocumentForAgent(dataConnect, { ...variables, documentId: target.id })
    case 'task':
      return linkKnowledgeTaskForAgent(dataConnect, { ...variables, taskId: target.id })
    case 'member':
      return linkKnowledgeMemberForAgent(dataConnect, { ...variables, memberId: target.userId })
  }
}

export default linkKnowledge
