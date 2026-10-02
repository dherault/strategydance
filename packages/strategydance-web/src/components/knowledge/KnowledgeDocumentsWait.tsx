import type { PropsWithChildren } from 'react'

import useOrganizationKnowledgeDocuments from '~hooks/knowledge/useOrganizationKnowledgeDocuments'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import Loading from '~components/common/Loading'

/*
  Holds a page that lists the knowledge until its first read lands. `initialLoading` rather than
  `loading`, since the live query writes over the list while somebody is looking at it.

  It keeps the team's live query open too, without waiting for it, as every page reading the
  organization's data does: the team's pushes are what tell the app the reader was removed or the
  organization deleted, which moves them on rather than leaving them on a list they cannot write to
*/
function KnowledgeDocumentsWait({ children }: PropsWithChildren) {
  const { initialLoading } = useOrganizationKnowledgeDocuments()

  useOrganizationTeam()

  if (initialLoading) {
    return <Loading source="KnowledgeDocumentsWait" />
  }

  return children
}

export default KnowledgeDocumentsWait
