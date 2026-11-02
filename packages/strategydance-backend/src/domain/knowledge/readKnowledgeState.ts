import type { KnowledgeKind } from 'strategydance-core'
import {
  KnowledgeKind as DatabaseKnowledgeKind,
  getKnowledgeItemsForAgent,
  type TaskStatus,
} from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { MAX_KNOWLEDGE_READ_LINKS } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

// Whether the organization uses an item and since when, or null when the agent never marked it
export type KnowledgeUse = { inUse: boolean; changedAt: string } | null

// An item's newest links to one kind of target, and how many it has in all
export type KnowledgeLinks<Link> = { items: Link[]; total: number }

// What the organization keeps of an item: its use, and what it is linked to
export type KnowledgeItemState = {
  use: KnowledgeUse
  documents: KnowledgeLinks<{ id: string; title: string }>
  tasks: KnowledgeLinks<{ id: string; name: string; status: TaskStatus }>
  members: KnowledgeLinks<{ member: string; name: string | null }>
}

type ReadKnowledgeStateResult = { outcome: 'notMember' } | { outcome: 'read'; states: Map<string, KnowledgeItemState> }

/*
  What the organization keeps of the items of a kind, by their ids: each item's use and its links,
  the 20 newest of each kind of target (`MAX_KNOWLEDGE_READ_LINKS`) with their total. The operation
  answers every link of the ids at once, newest first, since its limit is the whole list's, and only
  those the agent may see: a document kept from AI or deleted, and a deleted task, are left out, so
  their totals leave them out too. A caller who is no longer the member the module read is refused.
  Ids are dashless, as Data Connect writes them
*/
async function readKnowledgeState(
  caller: ModuleCaller,
  kind: KnowledgeKind,
  ids: string[],
): Promise<ReadKnowledgeStateResult> {
  const { data } = await getKnowledgeItemsForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    kind: DatabaseKnowledgeKind[kind],
    itemIds: ids,
  })

  if (data.membership.length === 0) return { outcome: 'notMember' }

  const states = new Map<string, KnowledgeItemState>(
    ids.map(id => [
      id,
      {
        use: null,
        documents: { items: [], total: 0 },
        tasks: { items: [], total: 0 },
        members: { items: [], total: 0 },
      },
    ]),
  )

  for (const use of data.knowledgeUses) {
    const state = states.get(use.itemId)

    if (state) state.use = { inUse: use.isInUse, changedAt: use.changedAt }
  }

  for (const { itemId, document } of data.knowledgeDocumentLinks) {
    addLink(states.get(itemId)?.documents, { id: toCanonicalUuid(document.id), title: document.title })
  }

  for (const { itemId, task } of data.knowledgeTaskLinks) {
    addLink(states.get(itemId)?.tasks, { id: toCanonicalUuid(task.id), name: task.name, status: task.status })
  }

  for (const { itemId, membership } of data.knowledgeMemberLinks) {
    addLink(states.get(itemId)?.members, {
      member: `member:${membership.userId}`,
      name: membership.user.displayName ?? null,
    })
  }

  return { outcome: 'read', states }
}

// Counts a link, and keeps it while the item has fewer than the newest it shows, the links coming
// newest first
function addLink<Link>(links: KnowledgeLinks<Link> | undefined, link: Link) {
  if (!links) return

  if (links.items.length < MAX_KNOWLEDGE_READ_LINKS) links.items.push(link)

  links.total++
}

export default readKnowledgeState
