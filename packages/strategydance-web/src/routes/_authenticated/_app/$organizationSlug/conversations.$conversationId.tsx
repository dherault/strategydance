import { createFileRoute, notFound } from '@tanstack/react-router'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import isConversationId from '~utils/conversation/isConversationId'
import parseConversationSearch from '~utils/conversation/parseConversationSearch'

import ConversationBouncer from '~components/conversation/ConversationBouncer'
import ConversationPage from '~components/conversation/ConversationPage'
import ConversationSubagentBouncer from '~components/conversation/ConversationSubagentBouncer'
import ConversationWait from '~components/conversation/ConversationWait'

/*
  One of the reader's conversations in the current organization, or a draft of one at the id it
  will have.

  A draft is this route rather than one of its own, so storing it is a change of search on the same
  route and the same params, which keeps the page mounted, as knowledge's is. So is a subagent's work
  open over the page, `?subagent=<id>`, where a subagent's own address sends the reader. An id that
  is not one is the app's not found page. Each search key is overwritten with `undefined` when it
  fails validation, since TanStack lays what this returns over the raw query rather than replacing it
*/
export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/conversations/$conversationId')({
  validateSearch: parseConversationSearch,
  beforeLoad: ({ params }) => {
    if (!isConversationId(params.conversationId)) throw notFound()
  },
  component: ConversationRoute,
})

function ConversationRoute() {
  const { conversationId } = Route.useParams()
  const { isNew, subagent } = Route.useSearch()
  const { organization } = useCurrentOrganization()

  return (
    <ConversationWait
      key={organization?.id ?? 'none'}
      conversationId={conversationId}
    >
      <ConversationBouncer
        conversationId={conversationId}
        isNew={isNew === true}
      >
        <ConversationSubagentBouncer conversationId={conversationId}>
          <ConversationPage
            key={conversationId}
            conversationId={conversationId}
            viewedSubagentId={subagent ?? null}
          />
        </ConversationSubagentBouncer>
      </ConversationBouncer>
    </ConversationWait>
  )
}
