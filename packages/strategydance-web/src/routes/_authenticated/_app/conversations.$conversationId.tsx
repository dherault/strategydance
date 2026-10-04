import { createFileRoute, notFound } from '@tanstack/react-router'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import isConversationId from '~utils/conversation/isConversationId'

import ConversationBouncer from '~components/conversation/ConversationBouncer'
import ConversationOrganizationBouncer from '~components/conversation/ConversationOrganizationBouncer'
import ConversationPage from '~components/conversation/ConversationPage'
import ConversationWait from '~components/conversation/ConversationWait'

type ConversationSearch = {
  // A draft at the id the conversation will have, opened by a "New conversation" button
  isNew?: true
}

/*
  One of the reader's conversations in the current organization, or a draft of one at the id it
  will have. It sits under the conversations' layout route, behind the bouncer that keeps them to
  whoever may have them until they launch.

  A draft is this route rather than one of its own, so storing it is a change of search on the same
  route and the same params, which keeps the page mounted, as knowledge's is. An id that is not one
  is the app's not found page. Each search key is overwritten with `undefined` when it fails
  validation, since TanStack lays what this returns over the raw query rather than replacing it
*/
export const Route = createFileRoute('/_authenticated/_app/conversations/$conversationId')({
  validateSearch: (search: Record<string, unknown>): ConversationSearch => ({
    isNew: search.isNew === true ? true : undefined,
  }),
  beforeLoad: ({ params }) => {
    if (!isConversationId(params.conversationId)) throw notFound()
  },
  component: ConversationRoute,
})

function ConversationRoute() {
  const { conversationId } = Route.useParams()
  const { isNew } = Route.useSearch()
  const { organization } = useCurrentOrganization()

  return (
    <ConversationOrganizationBouncer>
      <ConversationWait
        key={organization?.id ?? 'none'}
        conversationId={conversationId}
      >
        <ConversationBouncer
          conversationId={conversationId}
          isNew={isNew === true}
        >
          <ConversationPage
            key={conversationId}
            conversationId={conversationId}
          />
        </ConversationBouncer>
      </ConversationWait>
    </ConversationOrganizationBouncer>
  )
}
