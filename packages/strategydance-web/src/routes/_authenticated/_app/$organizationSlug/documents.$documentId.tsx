import { createFileRoute, notFound } from '@tanstack/react-router'
import { CompanyAspect } from 'strategydance-database/web'

import type { MessageType } from '~types'

import isDocumentId from '~utils/document/isDocumentId'

import DocumentPage from '~components/document/DocumentPage'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders
const DOCUMENT_MESSAGE_TYPES: MessageType[] = ['document']

type DocumentSearch = {
  // A draft at the id the document will have, opened by a "New document" button
  isNew?: true
  // The aspect the draft starts tagged with. Its value as the enum spells it, which TanStack writes
  // into the query as it is, and which goes with `isNew` once the draft is stored
  aspect?: CompanyAspect
  // The document's history open over it, as a thread's notification links to it, gone once closed
  history?: true
}

/*
  One of the current organization's documents, or a draft of one at the id it will have.

  A draft is this route rather than one of its own, so storing it is a change of search on the
  same route and the same params: TanStack keeps a route's component mounted through that, as
  nothing sets `remountDeps`, and the editor goes on under the reader's caret. For the same
  reason it has no loader and nothing async before it loads, which would show a pending match in
  its place for a moment. An id that is not one is the app's not found page.

  Each search key is overwritten with `undefined` when it fails validation, since TanStack lays
  what this returns over the raw query rather than replacing it
*/
export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/documents/$documentId')({
  validateSearch: (search: Record<string, unknown>): DocumentSearch => ({
    isNew: search.isNew === true ? true : undefined,
    aspect: Object.values(CompanyAspect).find(aspect => aspect === search.aspect),
    history: search.history === true ? true : undefined,
  }),
  beforeLoad: ({ params }) => {
    if (!isDocumentId(params.documentId)) throw notFound()
  },
  component: DocumentRoute,
})

function DocumentRoute() {
  const { documentId } = Route.useParams()
  const { isNew, aspect, history } = Route.useSearch()

  return (
    <IntlMessagesRegistration messageTypes={DOCUMENT_MESSAGE_TYPES}>
      <DocumentPage
        key={documentId}
        documentId={documentId}
        isNew={isNew === true}
        aspect={aspect ?? null}
        isHistoryRequested={history === true}
      />
    </IntlMessagesRegistration>
  )
}
