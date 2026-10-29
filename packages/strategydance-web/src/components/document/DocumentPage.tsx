import { useState } from 'react'
import type { CompanyAspect } from 'strategydance-database/web'

import useOrganizationDocument from '~hooks/document/useOrganizationDocument'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import DocumentBouncer from '~components/document/DocumentBouncer'
import DocumentEditor from '~components/document/DocumentEditor'
import DocumentWait from '~components/document/DocumentWait'

type Props = {
  documentId: string
  // Whether the address opened a draft rather than a stored document
  isNew: boolean
  aspect: CompanyAspect | null
  // Whether the address asks for the document's history open over it
  isHistoryRequested: boolean
}

/*
  One document's page: the document read, then judged, then edited. A draft has nothing to read
  or judge.

  Whether it is a draft is read once, as the page mounts. Storing the draft takes `isNew` off the
  address, and the page stays mounted through that: the editor goes on as it was, and nothing
  reads the document it has just stored.

  So is the organization, which the document belongs to: switching to another leaves for that one's
  documents, and the page stays on its own until the navigation has gone through the editor's,
  which sends what is left first
*/
function DocumentPage({ documentId, isNew, aspect, isHistoryRequested }: Props) {
  const { organization } = useCurrentOrganization()
  const [isDraft] = useState(isNew)
  const [organizationId] = useState(organization?.id ?? null)
  const { data: organizationDocument } = useOrganizationDocument({
    organizationId: organizationId ?? '',
    documentId,
    isEnabled: !isDraft && Boolean(organizationId),
  })

  if (!organizationId) return null

  return (
    <DocumentWait
      organizationId={organizationId}
      documentId={documentId}
      isEnabled={!isDraft}
    >
      <DocumentBouncer
        organizationId={organizationId}
        documentId={documentId}
        isEnabled={!isDraft}
      >
        <DocumentEditor
          organizationId={organizationId}
          documentId={documentId}
          organizationDocument={isDraft ? null : organizationDocument}
          draftAspect={aspect}
          isHistoryRequested={isHistoryRequested}
        />
      </DocumentBouncer>
    </DocumentWait>
  )
}

export default DocumentPage
