import { createFileRoute, notFound } from '@tanstack/react-router'
import { CompanyAspect } from 'strategydance-database/web'

import type { MessageType } from '~types'

import isKnowledgeDocumentId from '~utils/knowledge/isKnowledgeDocumentId'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import KnowledgeDocumentPage from '~components/knowledge/KnowledgeDocumentPage'

// At module scope so the reference is stable across renders
const KNOWLEDGE_MESSAGE_TYPES: MessageType[] = ['knowledge']

type KnowledgeDocumentSearch = {
  // A draft at the id the document will have, opened by an "Add knowledge" button
  isNew?: true
  // The aspect the draft starts tagged with. Its value as the enum spells it, which TanStack writes
  // into the query as it is, and which goes with `isNew` once the draft is stored
  aspect?: CompanyAspect
}

/*
  One document of the current organization's knowledge, or a draft of one at the id it will have.

  A draft is this route rather than one of its own, so storing it is a change of search on the
  same route and the same params: TanStack keeps a route's component mounted through that, as
  nothing sets `remountDeps`, and the editor goes on under the reader's caret. For the same
  reason it has no loader and nothing async before it loads, which would show a pending match in
  its place for a moment. An id that is not one is the app's not found page.

  Each search key is overwritten with `undefined` when it fails validation, since TanStack lays
  what this returns over the raw query rather than replacing it
*/
export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/knowledge/$documentId')({
  validateSearch: (search: Record<string, unknown>): KnowledgeDocumentSearch => ({
    isNew: search.isNew === true ? true : undefined,
    aspect: Object.values(CompanyAspect).find(aspect => aspect === search.aspect),
  }),
  beforeLoad: ({ params }) => {
    if (!isKnowledgeDocumentId(params.documentId)) throw notFound()
  },
  component: KnowledgeDocumentRoute,
})

function KnowledgeDocumentRoute() {
  const { documentId } = Route.useParams()
  const { isNew, aspect } = Route.useSearch()

  return (
    <IntlMessagesRegistration messageTypes={KNOWLEDGE_MESSAGE_TYPES}>
      <KnowledgeDocumentPage
        key={documentId}
        documentId={documentId}
        isNew={isNew === true}
        aspect={aspect ?? null}
      />
    </IntlMessagesRegistration>
  )
}
