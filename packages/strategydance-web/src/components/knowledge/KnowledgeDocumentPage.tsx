import { useState } from 'react'
import type { CompanyAspect } from 'strategydance-database/web'

import useKnowledgeDocument from '~hooks/knowledge/useKnowledgeDocument'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import KnowledgeDocumentBouncer from '~components/knowledge/KnowledgeDocumentBouncer'
import KnowledgeDocumentEditor from '~components/knowledge/KnowledgeDocumentEditor'
import KnowledgeDocumentWait from '~components/knowledge/KnowledgeDocumentWait'

type Props = {
  documentId: string
  // Whether the address opened a draft rather than a stored document
  isNew: boolean
  aspect: CompanyAspect | null
}

/*
  One document's page: the document read, then judged, then edited. A draft has nothing to read
  or judge.

  Whether it is a draft is read once, as the page mounts. Storing the draft takes `isNew` off the
  address, and the page stays mounted through that: the editor goes on as it was, and nothing
  reads the document it has just stored.

  So is the organization, which the document belongs to whatever the sidebar switches to: the page
  stays on it until the navigation `KnowledgeOrganizationBouncer` starts has gone through the
  editor's, which sends what is left first
*/
function KnowledgeDocumentPage({ documentId, isNew, aspect }: Props) {
  const { organization } = useCurrentOrganization()
  const [isDraft] = useState(isNew)
  const [organizationId] = useState(organization?.id ?? null)
  const { data: knowledgeDocument } = useKnowledgeDocument({
    organizationId: organizationId ?? '',
    documentId,
    isEnabled: !isDraft && Boolean(organizationId),
  })

  if (!organizationId) return null

  return (
    <KnowledgeDocumentWait
      organizationId={organizationId}
      documentId={documentId}
      isEnabled={!isDraft}
    >
      <KnowledgeDocumentBouncer
        organizationId={organizationId}
        documentId={documentId}
        isEnabled={!isDraft}
      >
        <KnowledgeDocumentEditor
          organizationId={organizationId}
          documentId={documentId}
          knowledgeDocument={isDraft ? null : knowledgeDocument}
          draftAspect={aspect}
        />
      </KnowledgeDocumentBouncer>
    </KnowledgeDocumentWait>
  )
}

export default KnowledgeDocumentPage
