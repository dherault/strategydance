import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import AuthenticationBouncer from '~components/authentication/AuthenticationBouncer'
import AuthenticationWait from '~components/authentication/AuthenticationWait'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import Onboarding from '~components/onboarding/Onboarding'
import OnboardingBouncer from '~components/onboarding/OnboardingBouncer'
import UserWait from '~components/user/UserWait'
import UserOrganizationsWait from '~components/userOrganization/UserOrganizationsWait'

// At module scope so the reference is stable across renders
const ONBOARDING_MESSAGE_TYPES: MessageType[] = ['onboarding']

/*
  The onboarding, for somebody signed in who belongs to no organization yet. Outside the
  authenticated area, since it takes the whole screen and is where the app sends those who cannot
  use it yet.

  The same waiters and bouncer as the authenticated area, in the same order and for the same
  reasons: creating the company needs the reader's row, and the last bouncer reads memberships
  that have arrived
*/
export const Route = createFileRoute('/prologue')({
  component: PrologueRoute,
})

function PrologueRoute() {
  return (
    <AuthenticationWait>
      <AuthenticationBouncer>
        <UserWait>
          <UserOrganizationsWait>
            <OnboardingBouncer>
              <IntlMessagesRegistration messageTypes={ONBOARDING_MESSAGE_TYPES}>
                <Onboarding />
              </IntlMessagesRegistration>
            </OnboardingBouncer>
          </UserOrganizationsWait>
        </UserWait>
      </AuthenticationBouncer>
    </AuthenticationWait>
  )
}
