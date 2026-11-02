import type { KnowledgeKind } from 'strategydance-core'
import {
  KnowledgeKind as DatabaseKnowledgeKind,
  getKnowledgeDocumentLinkForAgent,
  getKnowledgeMemberLinkForAgent,
  getKnowledgeTaskLinkForAgent,
  type TaskStatus,
} from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import type { KnowledgeLinkTargetInput } from '~domain/knowledge/toKnowledgeLinkTarget'

// A link's target, as a link or an unlink answers it: a document with its title, a task with its
// name and column, a member with their name
export type KnowledgeLinkReference =
  | { document: { id: string; title: string } }
  | { task: { id: string; name: string; status: TaskStatus } }
  | { member: { member: string; name: string | null } }

type ReadKnowledgeLinkTargetResult =
  | { outcome: 'notMember' }
  | { outcome: 'documentNotFound' }
  | { outcome: 'documentKeptFromAi' }
  | { outcome: 'taskNotFound' }
  | { outcome: 'memberNotFound' }
  | { outcome: 'read'; reference: KnowledgeLinkReference; isLinked: boolean; linkCount: number }

/*
  What a link or an unlink reads of its target before it writes, since the result it keeps under its
  idempotency key is written with the link: the target, refused when the organization does not hold
  it, when it is deleted, or, a document, when the team keeps it from AI; whether the item links it;
  and how many targets of its kind the item links, every one counted, those since kept from AI or
  deleted included, as the link's operation counts them against `MAX_KNOWLEDGE_LINKS`. A caller who
  is no longer the member the module read is refused
*/
async function readKnowledgeLinkTarget(
  caller: ModuleCaller,
  kind: KnowledgeKind,
  itemId: string,
  target: KnowledgeLinkTargetInput,
): Promise<ReadKnowledgeLinkTargetResult> {
  const variables = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    kind: DatabaseKnowledgeKind[kind],
    itemId,
  }

  switch (target.target) {
    case 'document': {
      const { data } = await getKnowledgeDocumentLinkForAgent(dataConnect, { ...variables, documentId: target.id })
      const [document] = data.documents

      if (data.membership.length === 0) return { outcome: 'notMember' }
      if (!document || document.deletedAt) return { outcome: 'documentNotFound' }
      if (!document.isAiReadable) return { outcome: 'documentKeptFromAi' }

      return {
        outcome: 'read',
        reference: { document: { id: target.id, title: document.title } },
        isLinked: data.knowledgeDocumentLinks.some(link => toCanonicalUuid(link.documentId) === target.id),
        linkCount: data.knowledgeDocumentLinks.length,
      }
    }
    case 'task': {
      const { data } = await getKnowledgeTaskLinkForAgent(dataConnect, { ...variables, taskId: target.id })
      const [task] = data.tasks

      if (data.membership.length === 0) return { outcome: 'notMember' }
      if (!task || task.deletedAt) return { outcome: 'taskNotFound' }

      return {
        outcome: 'read',
        reference: { task: { id: target.id, name: task.name, status: task.status } },
        isLinked: data.knowledgeTaskLinks.some(link => toCanonicalUuid(link.taskId) === target.id),
        linkCount: data.knowledgeTaskLinks.length,
      }
    }
    case 'member': {
      const { data } = await getKnowledgeMemberLinkForAgent(dataConnect, { ...variables, memberId: target.userId })
      const [member] = data.members

      if (data.membership.length === 0) return { outcome: 'notMember' }
      if (!member) return { outcome: 'memberNotFound' }

      return {
        outcome: 'read',
        reference: { member: { member: `member:${target.userId}`, name: member.user.displayName ?? null } },
        isLinked: data.knowledgeMemberLinks.some(link => link.membershipUserId === target.userId),
        linkCount: data.knowledgeMemberLinks.length,
      }
    }
  }
}

export default readKnowledgeLinkTarget
