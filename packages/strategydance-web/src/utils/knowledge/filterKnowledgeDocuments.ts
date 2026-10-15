import type { CompanyAspect } from 'strategydance-database/web'

import type { KnowledgeDocumentSummary } from '~types'

type Filters = {
  // Words the document's title holds, whatever their case. The list holds no document's text
  query: string
  // Any of these, or every document when there are none
  aspects: readonly CompanyAspect[]
}

// The documents the Knowledge page's filters leave on it, in the order they came in
function filterKnowledgeDocuments(
  knowledgeDocuments: readonly KnowledgeDocumentSummary[],
  { query, aspects }: Filters,
) {
  const words = query.trim().toLocaleLowerCase()

  return knowledgeDocuments.filter(knowledgeDocument => {
    if (aspects.length && !knowledgeDocument.aspects.some(aspect => aspects.includes(aspect))) return false
    if (!words) return true

    return knowledgeDocument.title.toLocaleLowerCase().includes(words)
  })
}

export default filterKnowledgeDocuments
