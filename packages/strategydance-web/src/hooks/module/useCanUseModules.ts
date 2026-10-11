import { ARE_MODULES_STAFF_ONLY } from 'strategydance-core'

import useUser from '~hooks/user/useUser'

import { EMULATORS_REQUESTED } from '~data/firebase'

/*
  Whether the reader may connect an external agent to Strategy Dance's modules. Until modules
  launch, only administrators of Strategy Dance itself may (`ARE_MODULES_STAFF_ONLY`), as the
  backend's consent routes and the token verifier hold them. Against the emulators every member
  may, as the development backend lets them, so the whole flow can be tried locally; a Hosting
  preview talks to the real project, and keeps the gate, as `useCanUseConversations` does.

  The consent page, the account page's Connected agents tab and the modules' "Use with your agents"
  buttons ask this first. `UserWait` holds the authenticated area until the reader's row has arrived,
  so the answer is never a guess
*/
function useCanUseModules() {
  const { data: user } = useUser()

  return !ARE_MODULES_STAFF_ONLY || EMULATORS_REQUESTED || (user?.isAdministrator ?? false)
}

export default useCanUseModules
