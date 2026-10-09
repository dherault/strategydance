import { ARE_CONVERSATIONS_STAFF_ONLY } from 'strategydance-core'

import useUser from '~hooks/user/useUser'

import { EMULATORS_REQUESTED } from '~data/firebase'

/*
  Whether the reader may have conversations. Until they launch, only administrators of Strategy
  Dance itself may (`ARE_CONVERSATIONS_STAFF_ONLY`), which hides an unfinished feature rather than
  protecting anything: a conversation is its author's alone either way. Against the emulators,
  `bun run dev` and `bun run preview`, every member of every organization may, as the development
  backend lets them, so the whole feature can be tried locally. A Hosting preview talks to the real
  project, and keeps the gate.

  Everything that offers a conversation asks this first: the sidebar, the pages' bouncer, and the
  aspect page's section and the dock to come. `UserWait` holds the authenticated area until the
  reader's row has arrived, so the answer is never a guess
*/
function useCanUseConversations() {
  const { data: user } = useUser()

  return !ARE_CONVERSATIONS_STAFF_ONLY || EMULATORS_REQUESTED || (user?.isAdministrator ?? false)
}

export default useCanUseConversations
