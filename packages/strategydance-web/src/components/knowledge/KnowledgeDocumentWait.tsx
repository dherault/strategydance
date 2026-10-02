import type { PropsWithChildren } from 'react'

import useKnowledgeDocument from '~hooks/knowledge/useKnowledgeDocument'

import Loading from '~components/common/Loading'

type Props = PropsWithChildren<{
  organizationId: string
  documentId: string
  // False for a draft, which has nothing to wait for
  isEnabled: boolean
}>

// Holds a document's page until the document is read, which its editor is seeded from
function KnowledgeDocumentWait({ organizationId, documentId, isEnabled, children }: Props) {
  const { initialLoading } = useKnowledgeDocument({ organizationId, documentId, isEnabled })

  if (initialLoading) {
    return <Loading source="KnowledgeDocumentWait" />
  }

  return children
}

export default KnowledgeDocumentWait
