import { useSyncExternalStore } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import {
  EMPTY_CONVERSATION_COMPOSER_DRAFT,
  getConversationComposerDraftKey,
  readConversationComposerDraft,
  subscribeToConversationComposerDrafts,
  updateConversationComposerDraft,
} from '~data/conversationComposerDrafts'

/*
  The messages the reader sent to a conversation that the thread does not hold with their bodies
  yet, oldest first, the one whose send is going, if any, and what forgets them once the thread does. Read
  apart from the rest of the composer's draft, so a thread does not draw itself again at each key the
  reader types
*/
function useConversationPendingMessages(conversationId: string) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const key = getConversationComposerDraftKey(viewer?.uid, organization?.id, conversationId)

  const pendingMessages = useSyncExternalStore(
    subscribeToConversationComposerDrafts,
    () => readConversationComposerDraft(key).pendingMessages,
    () => EMPTY_CONVERSATION_COMPOSER_DRAFT.pendingMessages,
  )
  const sendingMessageId = useSyncExternalStore(
    subscribeToConversationComposerDrafts,
    () => readConversationComposerDraft(key).sendingMessageId,
    () => null,
  )

  const isSending = sendingMessageId !== null
  const sendingMessage = pendingMessages.find(({ id }) => id === sendingMessageId) ?? null

  function forgetPendingMessages(ids: readonly string[]) {
    updateConversationComposerDraft(key, current =>
      current.pendingMessages.some(({ id }) => ids.includes(id))
        ? { ...current, pendingMessages: current.pendingMessages.filter(({ id }) => !ids.includes(id)) }
        : current,
    )
  }

  return { pendingMessages, isSending, sendingMessage, forgetPendingMessages }
}

export default useConversationPendingMessages
