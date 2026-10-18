import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useUser from '~hooks/user/useUser'

import type { ConversationSendFailure } from '~utils/conversation/getConversationSendFailure'

import { EMULATORS_REQUESTED } from '~data/firebase'

// What the composer says stands between the reader and Strategy Dance, whatever they write
export type ConversationAccessNotice = 'unverified' | 'accountSuspended' | 'organizationSuspended' | 'suspended'

/*
  What stands between the reader and Strategy Dance, as the composer says it above the field: staff
  suspended conversations for their account or in the organization, as their rows say, or as a
  refusal said before the rows were read again; or their address is not confirmed, as their ID
  token says, which is what the backend reads. Against the emulators the backend asks for no
  confirmed address, as its Auth emulator confirms none by itself, so the composer says so only once
  a send was refused for it. Null when nothing does
*/
function useConversationAccessNotice(failure: ConversationSendFailure | null): ConversationAccessNotice | null {
  const { emailVerified } = useAuthentication()
  const { data: user } = useUser()
  const { organization } = useCurrentOrganization()

  if (user?.conversationsSuspendedAt) return 'accountSuspended'
  if (organization?.conversationsSuspendedAt) return 'organizationSuspended'
  if (failure === 'suspended') return 'suspended'
  if (!emailVerified && (failure === 'unverified' || !EMULATORS_REQUESTED)) return 'unverified'

  return null
}

export default useConversationAccessNotice
