import type { PropsWithChildren } from 'react'

import useOrganizationDocument from '~hooks/document/useOrganizationDocument'

import Loading from '~components/common/Loading'

type Props = PropsWithChildren<{
  organizationId: string
  documentId: string
  // False for a draft, which has nothing to wait for
  isEnabled: boolean
}>

// Holds a document's page until the document is read, which its editor is seeded from
function DocumentWait({ organizationId, documentId, isEnabled, children }: Props) {
  const { initialLoading } = useOrganizationDocument({ organizationId, documentId, isEnabled })

  if (initialLoading) {
    return <Loading source="DocumentWait" />
  }

  return children
}

export default DocumentWait
