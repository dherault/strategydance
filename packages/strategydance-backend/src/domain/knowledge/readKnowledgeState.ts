import { type DirectoryStatus, type KnowledgeKind, readDirectoryStatus, toCanonicalUuid } from 'strategydance-core'
import {
  KnowledgeKind as DatabaseKnowledgeKind,
  getKnowledgeItemsForAgent,
  type TaskStatus,
} from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { MAX_KNOWLEDGE_READ_LINKS } from '~constants'

import { dataConnect } from '~firebase'

/*
  Whether the organization uses an item and since when, a directory's with where the organization
  stands with it, null for one to do, or null when the item was never marked
*/
export type KnowledgeUse = { inUse: boolean; changedAt: string; status?: DirectoryStatus | null } | null

// An item's notes as stored, and when they were last written, which a replacement is guarded on
export type KnowledgeNote = { content: string; updatedAt: string }

// An item's newest links to one kind of target, and how many it has in all
export type KnowledgeLinks<Link> = { items: Link[]; total: number }

// What the organization keeps of an item: its use, and what it is linked to
export type KnowledgeItemState = {
  use: KnowledgeUse
  documents: KnowledgeLinks<{ id: string; title: string }>
  tasks: KnowledgeLinks<{ id: string; name: string; status: TaskStatus }>
  members: KnowledgeLinks<{ member: string; name: string | null }>
}

type ReadKnowledgeStateResult =
  | { outcome: 'notMember' }
  | { outcome: 'read'; states: Map<string, KnowledgeItemState>; notes: Map<string, KnowledgeNote> }

/*
  What the organization keeps of the items of a kind, by their ids: each item's use, its notes apart
  from its state, since only a directory's are answered, and its links, the 20 newest of each kind
  of target (`MAX_KNOWLEDGE_READ_LINKS`) with their total. The operation answers every link of the
  ids at once, newest first, since its limit is the whole list's, and only those the agent may see:
  a document kept from AI or deleted, and a deleted task, are left out, so their totals leave them
  out too. A caller who is no longer the member the module read is refused. Ids are dashless, as
  Data Connect writes them
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

    if (state) {
      state.use = {
        inUse: use.isInUse,
        changedAt: use.changedAt,
        ...(kind === 'DIRECTORY' && { status: readDirectoryStatus(use) }),
      }
    }
  }

  const notes = new Map(
    data.knowledgeNotes.map(({ itemId, content, updatedAt }): [string, KnowledgeNote] => [
      itemId,
      { content, updatedAt },
    ]),
  )

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

  return { outcome: 'read', states, notes }
}

// Counts a link, and keeps it while the item has fewer than the newest it shows, the links coming
// newest first
function addLink<Link>(links: KnowledgeLinks<Link> | undefined, link: Link) {
  if (!links) return

  if (links.items.length < MAX_KNOWLEDGE_READ_LINKS) links.items.push(link)

  links.total++
}

export default readKnowledgeState
