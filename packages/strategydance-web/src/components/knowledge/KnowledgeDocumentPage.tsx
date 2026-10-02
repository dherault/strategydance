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
  reads the document it has just stored
*/
function KnowledgeDocumentPage({ documentId, isNew, aspect }: Props) {
  const { organization } = useCurrentOrganization()
  const [isDraft] = useState(isNew)
  const { data: knowledgeDocument } = useKnowledgeDocument(documentId, { isEnabled: !isDraft })

  if (!organization) return null

  return (
    <KnowledgeDocumentWait
      documentId={documentId}
      isEnabled={!isDraft}
    >
      <KnowledgeDocumentBouncer
        documentId={documentId}
        isEnabled={!isDraft}
      >
        <KnowledgeDocumentEditor
          organizationId={organization.id}
          documentId={documentId}
          knowledgeDocument={isDraft ? null : knowledgeDocument}
          draftAspect={aspect}
        />
      </KnowledgeDocumentBouncer>
    </KnowledgeDocumentWait>
  )
}

export default KnowledgeDocumentPage
