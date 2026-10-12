import useAuthentication from '~hooks/authentication/useAuthentication'
import useRemoveConversationAttachment from '~hooks/conversation/useRemoveConversationAttachment'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { abortConversationAttachmentUpload } from '~data/conversationAttachmentUploads'
import {
  EMPTY_CONVERSATION_COMPOSER_DRAFT,
  readConversationComposerDraft,
  updateConversationComposerDraft,
} from '~data/conversationComposerDrafts'

/*
  Discards a draft never stored, with what was written in it: its files stop going up and are
  removed, so they hold no place among the reader's unsent files, and its message is forgotten. A
  draft whose send has started, which stores it with its files, is left as it is. Whatever lets go
  of a draft, its dock window closed or pushed out by the dock's limit, goes through here
*/
function useDiscardConversationDraft() {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const removeConversationAttachment = useRemoveConversationAttachment()

  return function discardConversationDraft(conversationId: string) {
    // The draft's key, as `useConversationComposerDraft` makes it
    const key = `${viewer?.uid ?? ''}:${organization?.id ?? ''}:${conversationId}`
    const { attachments, sendingMessageId, startedRun } = readConversationComposerDraft(key)

    if (sendingMessageId || startedRun) return

    for (const { id } of attachments) {
      abortConversationAttachmentUpload(id)
      removeConversationAttachment({ conversationId, attachmentId: id }).catch((error: unknown) => {
        console.error('A file could not be removed, and is kept until it expires', error)
      })
    }

    updateConversationComposerDraft(key, () => EMPTY_CONVERSATION_COMPOSER_DRAFT)
  }
}

export default useDiscardConversationDraft
