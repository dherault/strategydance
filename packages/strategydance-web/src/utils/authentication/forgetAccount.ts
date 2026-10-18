import type { QueryClient } from '@tanstack/react-query'

import { clearTabStores } from '~utils/common/createTabStore'

import { abortConversationAttachmentUploads } from '~data/conversationAttachmentUploads'

/*
  Forgets what an account left in the tab once it leaves it, signed out or replaced by another: its
  uploads stop, what it had under way in the tab stores goes, and every query the cache holds, since
  most are keyed by the organization alone, so the next account of the same organization would
  first be drawn the previous one's conversations, documents and board until their reads came back
*/
function forgetAccount(queryClient: QueryClient) {
  abortConversationAttachmentUploads()
  clearTabStores()
  queryClient.clear()
}

export default forgetAccount
