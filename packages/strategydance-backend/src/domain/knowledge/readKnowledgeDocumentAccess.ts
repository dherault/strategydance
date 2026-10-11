import { getDocumentAccessForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

type KnowledgeDocumentAccess =
  | { outcome: 'notMember' }
  | { outcome: 'notFound' }
  | { outcome: 'found'; isAiReadable: boolean; isAiWritable: boolean; deletedAt: string | null }

/*
  Whether the caller is still the member the module was built for, and what the team lets agents do
  with a document, read once a read or a write that filters on them found nothing, to say why.
  Nothing of the document's text
*/
async function readKnowledgeDocumentAccess(caller: ModuleCaller, id: string): Promise<KnowledgeDocumentAccess> {
  const { data } = await getDocumentAccessForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    id,
  })

  if (data.membership.length === 0) return { outcome: 'notMember' }

  const [document] = data.documents

  if (!document) return { outcome: 'notFound' }

  return {
    outcome: 'found',
    isAiReadable: document.isAiReadable,
    isAiWritable: document.isAiWritable,
    deletedAt: document.deletedAt ?? null,
  }
}

export default readKnowledgeDocumentAccess
