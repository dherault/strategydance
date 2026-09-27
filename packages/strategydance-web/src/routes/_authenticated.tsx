import { Outlet, createFileRoute } from '@tanstack/react-router'

import AuthenticationBouncer from '~components/authentication/AuthenticationBouncer'
import AuthenticationWait from '~components/authentication/AuthenticationWait'
import UserWait from '~components/user/UserWait'
import UserOrganizationsWait from '~components/userOrganization/UserOrganizationsWait'

/*
  The authenticated area. Pathless, so its pages sit at the root beside the public ones: `/today`,
  `/team`, `/invitation/...`. Two routes cannot share a path, and the router generator fails the
  build when a page here takes a public page's name, so a clash cannot hide either. A dynamic
  segment is the exception, since a static route outranks it without a word: that is why the
  aspects live under `aspects/`.

  The order is the whole of the guarantee: the waiter resolves the Firebase handshake, the
  bouncer then reads a verdict rather than a maybe, and the second waiter holds the tree until
  the reader's row exists. A page below here can read `useUser().data` and find somebody there.

  The third holds it until the memberships are known, so `useUserOrganizations().data` is a list
  rather than a maybe, and `useCurrentOrganization()` resolves against a list that has arrived.
  It sits below the second rather than beside it because `UserOrganization.user` is a required
  foreign key: creating an organization before the reader's row exists is a constraint
  violation, not a slow request.

  The sidebar is not here but in the pathless `_app` below, since the invitation page takes the
  whole screen
*/
export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedRoute,
})

function AuthenticatedRoute() {
  return (
    <AuthenticationWait>
      <AuthenticationBouncer>
        <UserWait>
          <UserOrganizationsWait>
            <Outlet />
          </UserOrganizationsWait>
        </UserWait>
      </AuthenticationBouncer>
    </AuthenticationWait>
  )
}
