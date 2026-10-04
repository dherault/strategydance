import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useCanUseConversations from '~hooks/conversation/useCanUseConversations'

/*
  Lets a reader who may have conversations into their pages, and sends anybody else to today, as
  if the pages were not there: until conversations launch, that is administrators of Strategy
  Dance alone. Mounted once, around every page under `/conversations/`.

  Nothing to wait for, since `UserWait` already has the reader's row. An effect on the verdict
  rather than a `<Navigate>`, as in `AuthenticationBouncer`
*/
function ConversationsReleaseBouncer({ children }: PropsWithChildren) {
  const canUseConversations = useCanUseConversations()
  const navigate = useNavigate()

  useEffect(() => {
    if (canUseConversations) return

    navigate({
      to: '/today',
      replace: true,
    })
  }, [canUseConversations, navigate])

  if (!canUseConversations) return null

  return children
}

export default ConversationsReleaseBouncer
