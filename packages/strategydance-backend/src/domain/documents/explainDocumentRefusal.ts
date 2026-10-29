import type { DocumentsRefusal, ModuleCaller } from '~types'

import readDocumentAccess from '~domain/documents/readDocumentAccess'

/*
  Why a read or a write of a live document found nothing to read or change: the caller no longer the
  member, the document gone, or the team keeping agents from reading it, or from changing it when
  the call writes. Null when none of those holds, which leaves the caller to say why, a revision
  that moved say
*/
async function explainDocumentRefusal(
  caller: ModuleCaller,
  id: string,
  { isWrite }: { isWrite: boolean },
): Promise<DocumentsRefusal | null> {
  const access = await readDocumentAccess(caller, id)

  if (access.outcome !== 'found') return access
  if (access.deletedAt !== null) return { outcome: 'notFound' }
  if (!access.isAiReadable) return { outcome: 'keptFromAi' }
  if (isWrite && !access.isAiWritable) return { outcome: 'closedToAi' }

  return null
}

export default explainDocumentRefusal
