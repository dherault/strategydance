import { useEffect, useRef } from 'react'
import { markConversationRead } from 'strategydance-database/web'

import type { Conversation } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  Marks a conversation read while its page shows replies the reader has not seen, and only while
  the tab is in front of them: one in the background marks nothing until it comes back.

  It names the latest entry it showed, `previewMessageId`, and the server clears the count only
  while that is still the latest, so a reply landing meanwhile stays unread. Each entry is marked
  once, the next reply's id marks again, and a mark that failed is tried again with the next change
*/
function useMarkConversationRead(conversation: Conversation) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const markedRef = useRef<string | null>(null)

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const { id, unreadCount, previewMessageId } = conversation

  useEffect(() => {
    if (!unreadCount || !previewMessageId || !organizationId || !viewerId) return

    function mark() {
      if (document.visibilityState !== 'visible' || markedRef.current === previewMessageId) return

      markedRef.current = previewMessageId!
      markConversationRead(dataConnect, {
        organizationId: organizationId!,
        userId: viewerId!,
        id,
        previewMessageId: previewMessageId!,
      }).catch(error => {
        console.error('The conversation could not be marked read', error)
        markedRef.current = null
      })
    }

    mark()
    document.addEventListener('visibilitychange', mark)

    return () => document.removeEventListener('visibilitychange', mark)
  }, [id, unreadCount, previewMessageId, organizationId, viewerId])
}

export default useMarkConversationRead
