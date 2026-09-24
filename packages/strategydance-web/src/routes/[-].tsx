import { Outlet, createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import AuthenticationBouncer from '~components/authentication/AuthenticationBouncer'
import AuthenticationWait from '~components/authentication/AuthenticationWait'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import AppLayout from '~components/layout/AppLayout'
import UserWait from '~components/user/UserWait'
import UserOrganizationsWait from '~components/userOrganization/UserOrganizationsWait'

// At module scope so the reference is stable across renders
const AUTHENTICATED_MESSAGE_TYPES: MessageType[] = ['navigation']

/*
  The authenticated area. `[-]` rather than `-`, because the router generator ignores any file
  whose name starts with `routeFileIgnorePrefix`, which defaults to `-`. The brackets are its
  own escape syntax and unwrap to a literal, so this is `/-` without changing that prefix
  globally and re-enabling every excluded file in the tree.

  The order is the whole of the guarantee: the waiter resolves the Firebase handshake, the
  bouncer then reads a verdict rather than a maybe, and the second waiter holds the tree until
  the reader's row exists. A page below here can read `useUser().data` and find somebody there.

  The third holds it until the memberships are known, so `useUserOrganizations().data` is a list
  rather than a maybe, and `useCurrentOrganization()` resolves against a list that has arrived.
  It sits below the second rather than beside it because `UserOrganization.user` is a required
  foreign key: creating an organization before the reader's row exists is a constraint
  violation, not a slow request.

  The layout comes last, since its sidebar reads all three, and after the catalogue its words
  come from
*/
export const Route = createFileRoute('/-')({
  component: AuthenticatedRoute,
})

function AuthenticatedRoute() {
  return (
    <AuthenticationWait>
      <AuthenticationBouncer>
        <UserWait>
          <UserOrganizationsWait>
            <IntlMessagesRegistration messageTypes={AUTHENTICATED_MESSAGE_TYPES}>
              <AppLayout>
                <Outlet />
              </AppLayout>
            </IntlMessagesRegistration>
          </UserOrganizationsWait>
        </UserWait>
      </AuthenticationBouncer>
    </AuthenticationWait>
  )
}
