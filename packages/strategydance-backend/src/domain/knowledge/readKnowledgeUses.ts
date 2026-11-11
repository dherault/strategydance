import { type DirectoryStatus, type KnowledgeKind, readDirectoryStatus } from 'strategydance-core'
import { KnowledgeKind as DatabaseKnowledgeKind, getKnowledgeUsesForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

type ReadKnowledgeUsesResult =
  | { outcome: 'notMember' }
  | { outcome: 'read'; inUse: Set<string>; directoryStatuses: Map<string, DirectoryStatus> }

/*
  The ids of a kind's items the organization uses, as `list_knowledge` marks its rows with them, and
  for directories each one's status, those in use from before statuses read as submitted. A caller
  who is no longer the member the module read is refused rather than shown nothing in use. An id the
  catalogue lost may be among them, which no row of the catalogue asks for
*/
async function readKnowledgeUses(caller: ModuleCaller, kind: KnowledgeKind): Promise<ReadKnowledgeUsesResult> {
  const { data } = await getKnowledgeUsesForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    kind: DatabaseKnowledgeKind[kind],
  })

  if (data.membership.length === 0) return { outcome: 'notMember' }

  const inUse = new Set(data.knowledgeUses.map(({ itemId }) => itemId))
  const given = new Map(data.directoryStatuses.map(({ itemId, directoryStatus }) => [itemId, directoryStatus]))
  const directoryStatuses = new Map<string, DirectoryStatus>()

  if (kind === 'DIRECTORY') {
    for (const itemId of new Set([...inUse, ...given.keys()])) {
      const status = readDirectoryStatus({ isInUse: inUse.has(itemId), directoryStatus: given.get(itemId) })

      if (status) directoryStatuses.set(itemId, status)
    }
  }

  return { outcome: 'read', inUse, directoryStatuses }
}

export default readKnowledgeUses
