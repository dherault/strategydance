import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getConversationsAwaitingAnswerRef } from 'strategydance-database/web'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_IDS: string[] = []

/*
  The ids of the reader's conversations in the current organization where a question waits for
  their answer, kept live, for the sidebar's count. Read on every page of the app, so it reads the
  ids alone, and never behind a waiter: the sidebar draws no count until it lands, and none if it
  fails. Only a reader who may have conversations calls it
*/
function useConversationsAwaitingAnswer() {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)
  // The key names whose conversations they are: the tab's cache outlives a sign-out
  const queryKey = ['GetConversationsAwaitingAnswer', organizationId, viewerId]

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: result } = await executeQuery(
        getConversationsAwaitingAnswerRef(dataConnect, { organizationId: organizationId! }),
      )

      return result
    },
    enabled: isEnabled,
  })

  useLiveQuerySubscription({
    name: 'conversations awaiting an answer',
    queryKey: isEnabled ? queryKey : null,
    createQueryRef: () => getConversationsAwaitingAnswerRef(dataConnect, { organizationId: organizationId! }),
  })

  return data?.conversations.map(({ id }) => id) ?? EMPTY_IDS
}

export default useConversationsAwaitingAnswer
