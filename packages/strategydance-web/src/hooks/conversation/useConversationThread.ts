import { QueryFetchPolicy } from 'firebase/data-connect'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { getConversationMessageBodies, getConversationMessagesBefore } from 'strategydance-database/web'

import type { Conversation, ConversationTail } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import createConversationThread from '~utils/conversation/createConversationThread'

import { dataConnect } from '~data/firebase'

function toTail(conversation: Conversation): ConversationTail {
  return {
    historyRevision: conversation.historyRevision,
    nextMessagePosition: conversation.nextMessagePosition,
    messages: conversation.conversationMessages_on_conversation,
  }
}

/*
  A conversation's thread as its page draws it: the live tail `useConversation` keeps, merged with
  the older messages read in pages and each message's body, by `createConversationThread`.

  The thread is made once, from the conversation as the page first read it, so its first paint has
  the tail, and every later tail is handed to it from an effect, which is safe to repeat. Pages are
  read from the server alone, since the SDK would hand back a cached page from before a Retry.
  Under `ConversationWait`, which is keyed on the organization, so the one read here is the
  conversation's
*/
function useConversationThread(conversation: Conversation) {
  const { organization } = useCurrentOrganization()
  const [thread] = useState(() => {
    const key = { organizationId: organization?.id ?? '', id: conversation.id }

    return createConversationThread({
      tail: toTail(conversation),
      readPage: async beforePosition => {
        const { data } = await getConversationMessagesBefore(
          dataConnect,
          { ...key, beforePosition },
          { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
        )
        const found = data.conversations[0]

        return found ? { historyRevision: found.historyRevision, messages: data.conversationMessages } : null
      },
      readBodies: async messageIds => {
        const { data } = await getConversationMessageBodies(dataConnect, { ...key, messageIds })

        return data.conversationMessages
      },
    })
  })

  useEffect(() => {
    thread.receive(toTail(conversation))
  }, [thread, conversation])

  const snapshot = useSyncExternalStore(thread.subscribe, thread.getSnapshot, thread.getSnapshot)

  return { ...snapshot, loadOlder: thread.loadOlder }
}

export default useConversationThread
