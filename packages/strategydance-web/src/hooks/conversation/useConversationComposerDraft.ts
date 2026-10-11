import { useSyncExternalStore } from 'react'

import {
  EMPTY_CONVERSATION_COMPOSER_DRAFT,
  readConversationComposerDraft,
  subscribeToConversationComposerDrafts,
} from '~data/conversationComposerDrafts'

/*
  The message the reader is writing to a conversation, and where its sending stands, as every
  composer drawing the conversation shares it. Nothing is held while the document shell is
  prerendered
*/
function useConversationComposerDraft(conversationId: string) {
  return useSyncExternalStore(
    subscribeToConversationComposerDrafts,
    () => readConversationComposerDraft(conversationId),
    () => EMPTY_CONVERSATION_COMPOSER_DRAFT,
  )
}

export default useConversationComposerDraft
