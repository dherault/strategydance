import { useSyncExternalStore } from 'react'

import { readConversationComposerDraft, subscribeToConversationComposerDrafts } from '~data/conversationComposerDrafts'

/*
  What the reader wrote to a conversation and has not sent, as every composer drawing it shares it,
  or null. Nothing is held while the document shell is prerendered
*/
function useConversationComposerDraft(conversationId: string) {
  return useSyncExternalStore(
    subscribeToConversationComposerDrafts,
    () => readConversationComposerDraft(conversationId),
    () => null,
  )
}

export default useConversationComposerDraft
