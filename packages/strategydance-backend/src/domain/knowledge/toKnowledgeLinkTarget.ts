import type { ModuleCaller } from '~types'

import toCanonicalUuid from '~utils/toCanonicalUuid'

// What a link or an unlink names: a document or a task by its id, or a member by their user id
export type KnowledgeLinkTargetInput =
  | { target: 'document'; id: string }
  | { target: 'task'; id: string }
  | { target: 'member'; userId: string }

type KnowledgeLinkArguments = { documentId?: string; taskId?: string; member?: string }

/*
  The one target a link or an unlink names, or null when it names none or more than one. A member is
  `"me"`, the member the agent acts as, or `"member:<id>"`, as a task's assignee is named, so no
  member's id is read as the word. Ids are dashless, as Data Connect writes them
*/
function toKnowledgeLinkTarget(
  caller: ModuleCaller,
  { documentId, taskId, member }: KnowledgeLinkArguments,
): KnowledgeLinkTargetInput | null {
  if ([documentId, taskId, member].filter(value => value !== undefined).length !== 1) return null
  if (documentId !== undefined) return { target: 'document', id: toCanonicalUuid(documentId) }
  if (taskId !== undefined) return { target: 'task', id: toCanonicalUuid(taskId) }

  return { target: 'member', userId: member === 'me' ? caller.userId : member!.slice('member:'.length) }
}

export default toKnowledgeLinkTarget
