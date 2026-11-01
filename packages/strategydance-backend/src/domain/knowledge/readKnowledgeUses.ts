import type { KnowledgeKind } from 'strategydance-core'
import { KnowledgeKind as DatabaseKnowledgeKind, getKnowledgeUsesForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

type ReadKnowledgeUsesResult = { outcome: 'notMember' } | { outcome: 'read'; inUse: Set<string> }

/*
  The ids of a kind's items the organization uses, as `list_knowledge` marks its rows with them. A
  caller who is no longer the member the module read is refused rather than shown nothing in use. An
  id the catalogue lost may be among them, which no row of the catalogue asks for
*/
async function readKnowledgeUses(caller: ModuleCaller, kind: KnowledgeKind): Promise<ReadKnowledgeUsesResult> {
  const { data } = await getKnowledgeUsesForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    kind: DatabaseKnowledgeKind[kind],
  })

  if (data.membership.length === 0) return { outcome: 'notMember' }

  return { outcome: 'read', inUse: new Set(data.knowledgeUses.map(({ itemId }) => itemId)) }
}

export default readKnowledgeUses
