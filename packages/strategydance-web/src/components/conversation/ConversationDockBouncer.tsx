import { useMatch } from '@tanstack/react-router'
import type { PropsWithChildren } from 'react'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

import useCanUseConversations from '~hooks/conversation/useCanUseConversations'
import useConversationDock from '~hooks/conversation/useConversationDock'

/*
  Whether the dock is drawn: for a reader who may have conversations, on a wide screen, while it
  holds windows, and anywhere but a conversation's page, which takes its own conversation out of the
  dock and needs the room the dock would cover. A phone has no dock: a conversation opens as its page
*/
function ConversationDockBouncer({ children }: PropsWithChildren) {
  const canUseConversations = useCanUseConversations()
  const { isMobile } = useSidebar()
  const { windows } = useConversationDock()
  const isConversationPage = !!useMatch({
    from: '/_authenticated/_app/$organizationSlug/conversations/$conversationId',
    shouldThrow: false,
  })

  if (!canUseConversations || isMobile || isConversationPage || !windows.length) return null

  return children
}

export default ConversationDockBouncer
