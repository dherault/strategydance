import type { DocumentSummary } from '~types'

import useNow from '~hooks/common/useNow'

import DocumentCard from '~components/document/DocumentCard'

type Props = {
  organizationDocuments: DocumentSummary[]
}

// Documents as cards, three to a row where there is room for them, fewer in a narrower column. The
// Documents page's search is as wide as a column, at the same breakpoints and gap
// (`DocumentFilters`): a change to either changes both
function DocumentGrid({ organizationDocuments }: Props) {
  const now = useNow()

  return (
    <div className="@container">
      <div className="grid grid-cols-3 gap-4 @max-[720px]:grid-cols-2 @max-[460px]:grid-cols-1">
        {organizationDocuments.map(organizationDocument => (
          <DocumentCard
            key={organizationDocument.id}
            organizationDocument={organizationDocument}
            now={now}
          />
        ))}
      </div>
    </div>
  )
}

export default DocumentGrid
