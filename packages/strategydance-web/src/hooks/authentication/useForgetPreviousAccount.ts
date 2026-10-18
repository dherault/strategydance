import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { clearTabStores } from '~utils/common/createTabStore'

import { abortConversationAttachmentUploads } from '~data/conversationAttachmentUploads'

/*
  Forgets what an account left in the tab once it leaves, signed out or replaced by another: its
  uploads stop, what it had under way in the tab stores goes, and every query the cache holds, since
  most are keyed by the organization alone, so the next account of the same organization would
  first be drawn the previous one's conversations, documents and board until their reads came back.
  Nothing happens for the first account the tab sees, nor while the session is still being restored
*/
function useForgetPreviousAccount(uid: string | null, isLoading: boolean) {
  const queryClient = useQueryClient()
  // The account the tab last saw, once the session was restored
  const previousUid = useRef<string | null>(null)

  useEffect(() => {
    if (isLoading) return

    if (previousUid.current && previousUid.current !== uid) {
      abortConversationAttachmentUploads()
      clearTabStores()
      queryClient.clear()
    }

    previousUid.current = uid
  }, [uid, isLoading, queryClient])
}

export default useForgetPreviousAccount
