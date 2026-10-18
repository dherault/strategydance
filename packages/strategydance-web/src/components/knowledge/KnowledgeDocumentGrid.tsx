import type { KnowledgeDocumentSummary } from '~types'

import useNow from '~hooks/common/useNow'

import KnowledgeDocumentCard from '~components/knowledge/KnowledgeDocumentCard'

type Props = {
  knowledgeDocuments: KnowledgeDocumentSummary[]
}

// Documents as cards, three to a row where there is room for them, fewer in a narrower column. The
// Knowledge page's search is as wide as a column, at the same breakpoints and gap
// (`KnowledgeDocumentFilters`): a change to either changes both
function KnowledgeDocumentGrid({ knowledgeDocuments }: Props) {
  const now = useNow()

  return (
    <div className="@container">
      <div className="grid grid-cols-3 gap-4 @max-[720px]:grid-cols-2 @max-[460px]:grid-cols-1">
        {knowledgeDocuments.map(knowledgeDocument => (
          <KnowledgeDocumentCard
            key={knowledgeDocument.id}
            knowledgeDocument={knowledgeDocument}
            now={now}
          />
        ))}
      </div>
    </div>
  )
}

export default KnowledgeDocumentGrid
