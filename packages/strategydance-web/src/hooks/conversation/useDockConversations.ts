import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getDockConversationsRef } from 'strategydance-database/web'

import type { DockConversation } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  The conversations the dock's windows hold, by id, kept live for what their headers show: the
  title, whether a run goes, the replies unread and a question waiting. A minimized window reads
  nothing else, so its count goes up as replies land and down once the reader has read them.

  The ids are read sorted, so moving a window leaves the read as it is, and opening one keeps the
  last read on screen until the next lands. Whether a read is settled says it is the one for these
  very ids, and current, which only then says which of them are stored: closing a window can bring
  back the ids of an older read still cached, from before a draft among them was stored, which is
  read again before it settles anything. Only a reader who may have conversations calls it
*/
function useDockConversations(conversationIds: string[]) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const ids = [...conversationIds].sort()
  const isEnabled = Boolean(organizationId && viewerId && ids.length)
  // The key names whose conversations they are: the tab's cache outlives a sign-out
  const queryKey = ['GetDockConversations', organizationId, viewerId, ids]

  const { data, isSuccess, isPlaceholderData, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: result } = await executeQuery(
        getDockConversationsRef(dataConnect, { organizationId: organizationId!, ids }),
      )

      return result
    },
    enabled: isEnabled,
    placeholderData: keepPreviousData,
  })

  useLiveQuerySubscription({
    name: 'docked conversations',
    queryKey: isEnabled ? queryKey : null,
    createQueryRef: () => getDockConversationsRef(dataConnect, { organizationId: organizationId!, ids }),
  })

  return {
    conversations: new Map<string, DockConversation>(
      data?.conversations.map(conversation => [conversation.id, conversation]),
    ),
    isSettled: isEnabled && isSuccess && !isPlaceholderData && !isFetching,
  }
}

export default useDockConversations
