import { useSyncExternalStore } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import {
  getConversationComposerDraftKey,
  readConversationComposerDraft,
  subscribeToConversationComposerDrafts,
  updateConversationComposerDraft,
} from '~data/conversationComposerDrafts'

/*
  The message the reader last sent to a conversation, while the thread does not hold it yet, whether
  its send is still going, and what forgets it once the thread does. Read apart from the rest of the
  composer's draft, so a thread does not draw itself again at each key the reader types
*/
function useConversationPendingMessage(conversationId: string) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const key = getConversationComposerDraftKey(viewer?.uid, organization?.id, conversationId)

  const pendingMessage = useSyncExternalStore(
    subscribeToConversationComposerDrafts,
    () => readConversationComposerDraft(key).pendingMessage,
    () => null,
  )
  const isSending = useSyncExternalStore(
    subscribeToConversationComposerDrafts,
    () => readConversationComposerDraft(key).sendingMessageId !== null,
    () => false,
  )

  // Unless another message has been sent since
  function forgetPendingMessage(id: string) {
    updateConversationComposerDraft(key, current =>
      current.pendingMessage?.id === id ? { ...current, pendingMessage: null } : current,
    )
  }

  return { pendingMessage, isSending, forgetPendingMessage }
}

export default useConversationPendingMessage
