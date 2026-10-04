import { createFileRoute } from '@tanstack/react-router'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import Conversations from '~components/conversation/Conversations'
import ConversationsWait from '~components/conversation/ConversationsWait'

// The reader's conversations in the current organization
export const Route = createFileRoute('/_authenticated/_app/conversations/')({
  component: ConversationsIndexRoute,
})

function ConversationsIndexRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <ConversationsWait key={organization?.id ?? 'none'}>
      <Conversations />
    </ConversationsWait>
  )
}
