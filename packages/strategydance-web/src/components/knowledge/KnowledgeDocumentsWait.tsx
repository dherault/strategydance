import type { PropsWithChildren } from 'react'

import useOrganizationKnowledgeDocuments from '~hooks/knowledge/useOrganizationKnowledgeDocuments'

import Loading from '~components/common/Loading'

/*
  Holds a page that lists the knowledge until its first read lands. `initialLoading` rather than
  `loading`, since the live query writes over the list while somebody is looking at it
*/
function KnowledgeDocumentsWait({ children }: PropsWithChildren) {
  const { initialLoading } = useOrganizationKnowledgeDocuments()

  if (initialLoading) {
    return <Loading source="KnowledgeDocumentsWait" />
  }

  return children
}

export default KnowledgeDocumentsWait
