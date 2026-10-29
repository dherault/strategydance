import type { DocumentSummary } from '~types'

import useOrganizationDocuments from '~hooks/document/useOrganizationDocuments'

/*
  The organization's documents as a conversation's thread looks them up, by id, kept live, so a
  link to one draws its current title and a deleted one is gone from it at once. Read only once the
  thread `needs` them, and null until they have landed, or when they could not be read, when the
  thread draws what the agent wrote and decides nothing. The list leaves deleted documents out, so
  an id it lacks names one deleted, pruned or never there
*/
function useConversationDocuments(needs: boolean): ReadonlyMap<string, DocumentSummary> | null {
  const { data, initialLoading, hasFailed } = useOrganizationDocuments({ isEnabled: needs })

  if (!needs || initialLoading || hasFailed) return null

  return new Map(data.map(document => [document.id.replaceAll('-', '').toLowerCase(), document]))
}

export default useConversationDocuments
