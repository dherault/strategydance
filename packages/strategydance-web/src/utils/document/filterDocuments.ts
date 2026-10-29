import type { CompanyAspect } from 'strategydance-database/web'

import type { DocumentSummary } from '~types'

type Filters = {
  // Words the document's title holds, whatever their case. The list holds no document's text
  query: string
  // Any of these, or every document when there are none
  aspects: readonly CompanyAspect[]
}

// The documents the Documents page's filters leave on it, in the order they came in
function filterDocuments(organizationDocuments: readonly DocumentSummary[], { query, aspects }: Filters) {
  const words = query.trim().toLocaleLowerCase()

  return organizationDocuments.filter(organizationDocument => {
    if (aspects.length && !organizationDocument.aspects.some(aspect => aspects.includes(aspect))) return false
    if (!words) return true

    return organizationDocument.title.toLocaleLowerCase().includes(words)
  })
}

export default filterDocuments
