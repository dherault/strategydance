import { useSyncExternalStore } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

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

  It is the signed-in account's in the current organization: the store outlives a sign-out, and
  another account signing in on the tab, opening the same draft's address from the history, finds
  nothing of it, nor does the same draft's id under another organization's address, which a draft
  not stored yet belongs to nothing to stop. A change keeps to the account and organization it was
  made for, so a send that lands after a sign-out or a switch settles their message. Nothing is held
  while the document shell is prerendered
*/
function useConversationComposerDraft(conversationId: string) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const key = `${viewer?.uid ?? ''}:${organization?.id ?? ''}:${conversationId}`

  const draft = useSyncExternalStore(
    subscribeToConversationComposerDrafts,
    () => readConversationComposerDraft(key),
    () => EMPTY_CONVERSATION_COMPOSER_DRAFT,
  )

  function changeDraft(change: (current: ConversationComposerDraft) => Partial<ConversationComposerDraft>) {
    updateConversationComposerDraft(key, current => ({ ...current, ...change(current) }))
  }

  // The draft as it stands now, for what reads it after awaiting something
  function readDraft() {
    return readConversationComposerDraft(key)
  }

  return [draft, changeDraft, readDraft] as const
}

export default useConversationComposerDraft
