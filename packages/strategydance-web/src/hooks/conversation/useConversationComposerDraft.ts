import { useSyncExternalStore } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'

import {
  type ConversationComposerDraft,
  EMPTY_CONVERSATION_COMPOSER_DRAFT,
  readConversationComposerDraft,
  subscribeToConversationComposerDrafts,
  updateConversationComposerDraft,
} from '~data/conversationComposerDrafts'

/*
  The message the reader is writing to a conversation, and where its sending stands, as every
  composer drawing the conversation shares it, and what changes it there.

  It is the signed-in account's: the store outlives a sign-out, and another account signing in on
  the tab, opening the same draft's address from the history, finds nothing of it. A change keeps
  to the account it was made for, so a send that lands after a sign-out settles that account's
  message. Nothing is held while the document shell is prerendered
*/
function useConversationComposerDraft(conversationId: string) {
  const { data: viewer } = useAuthentication()
  const key = `${viewer?.uid ?? ''}:${conversationId}`

  const draft = useSyncExternalStore(
    subscribeToConversationComposerDrafts,
    () => readConversationComposerDraft(key),
    () => EMPTY_CONVERSATION_COMPOSER_DRAFT,
  )

  function changeDraft(change: (current: ConversationComposerDraft) => Partial<ConversationComposerDraft>) {
    updateConversationComposerDraft(key, current => ({ ...current, ...change(current) }))
  }

  return [draft, changeDraft] as const
}

export default useConversationComposerDraft
