import { Outlet, createFileRoute } from '@tanstack/react-router'

import AuthenticationBouncer from '~components/authentication/AuthenticationBouncer'
import AuthenticationWait from '~components/authentication/AuthenticationWait'
import UserWait from '~components/user/UserWait'

/*
  The authenticated area. `[-]` rather than `-`, because the router generator ignores any file
  whose name starts with `routeFileIgnorePrefix`, which defaults to `-`. The brackets are its
  own escape syntax and unwrap to a literal, so this is `/-` without changing that prefix
  globally and re-enabling every excluded file in the tree.

  The order is the whole of the guarantee: the waiter resolves the Firebase handshake, the
  bouncer then reads a verdict rather than a maybe, and the second waiter holds the tree until
  the reader's row exists. A page below here can read `useUser().data` and find somebody there
*/
export const Route = createFileRoute('/-')({
  component: AuthenticatedRoute,
})

function AuthenticatedRoute() {
  return (
    <AuthenticationWait>
      <AuthenticationBouncer>
        <UserWait>
          <Outlet />
        </UserWait>
      </AuthenticationBouncer>
    </AuthenticationWait>
  )
}
