import type { PropsWithChildren } from 'react'

import useConversations from '~hooks/conversation/useConversations'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import Loading from '~components/common/Loading'

/*
  Holds the conversations list until its first read lands. `initialLoading` rather than `loading`,
  since the live query writes over the list while somebody is looking at it.

  It keeps the team's live query open too, without waiting for it, as `KnowledgeDocumentsWait`
  does: the team's pushes are what tell the app the reader was removed or the organization deleted
*/
function ConversationsWait({ children }: PropsWithChildren) {
  const { initialLoading } = useConversations()

  useOrganizationTeam()

  if (initialLoading) {
    return <Loading source="ConversationsWait" />
  }

  return children
}

export default ConversationsWait
