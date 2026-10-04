import { ARE_CONVERSATIONS_STAFF_ONLY } from 'strategydance-core'

import useUser from '~hooks/user/useUser'

/*
  Whether the reader may have conversations. Until they launch, only administrators of Strategy
  Dance itself may (`ARE_CONVERSATIONS_STAFF_ONLY`), which hides an unfinished feature rather than
  protecting anything: a conversation is its author's alone either way.

  Everything that offers a conversation asks this first: the sidebar, the pages' bouncer, and the
  aspect page's section and the dock to come. `UserWait` holds the authenticated area until the
  reader's row has arrived, so the answer is never a guess
*/
function useCanUseConversations() {
  const { data: user } = useUser()

  return !ARE_CONVERSATIONS_STAFF_ONLY || (user?.isAdministrator ?? false)
}

export default useCanUseConversations
