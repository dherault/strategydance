import { ARE_CONVERSATIONS_STAFF_ONLY } from 'strategydance-core'

import useUser from '~hooks/user/useUser'

import { EMULATORS_REQUESTED } from '~data/firebase'

/*
  Whether the reader may see the organization's integrations. They are what conversations call, so
  they open with them: until conversations launch, only administrators of Strategy Dance itself may
  (`ARE_CONVERSATIONS_STAFF_ONLY`), and against the emulators every member of every organization
  may, as the development backend lets them, the same two as `useCanUseConversations`. It hides an
  unfinished feature: the servers are the organization's to read either way.

  The sidebar and the page's bouncer ask it
*/
function useCanUseIntegrations() {
  const { data: user } = useUser()

  return !ARE_CONVERSATIONS_STAFF_ONLY || EMULATORS_REQUESTED || (user?.isAdministrator ?? false)
}

export default useCanUseIntegrations
