import { Outlet, createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import AuthenticationLayout from '~components/authentication/AuthenticationLayout'
import AuthenticationRedirect from '~components/authentication/AuthenticationRedirect'
import AuthenticationWait from '~components/authentication/AuthenticationWait'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders
const AUTHENTICATION_MESSAGE_TYPES: MessageType[] = ['authentication']

type AuthenticationSearch = {
  passwordResetSent?: boolean
}

export const Route = createFileRoute('/authentication')({
  /*
    `passwordResetSent` is omitted rather than set to false when it is absent. TanStack rewrites
    the URL to whatever this returns, so emitting it unconditionally turns a plain
    `/authentication` into a redirect to `/authentication?passwordResetSent=false`.

    The page to return to once signed in is not in the query: `AuthenticationBouncer` keeps it in
    the browser's storage, and `AuthenticationRedirect` reads it from there
  */
  validateSearch: (search: Record<string, unknown>): AuthenticationSearch => {
    const validated: AuthenticationSearch = {}

    if (search.passwordResetSent === true || search.passwordResetSent === 'true') validated.passwordResetSent = true

    return validated
  },
  component: AuthenticationRoute,
})

/*
  The waiter sits above the redirect, which is the load-bearing order: the redirect reads a
  viewer of `null` as signed out, and during the session restore round trip that is also what
  "not answered yet" looks like. Reversed, a signed-in reader would see the sign-in form flash
  before being sent on
*/
function AuthenticationRoute() {
  const { passwordResetSent } = Route.useSearch()

  return (
    <IntlMessagesRegistration messageTypes={AUTHENTICATION_MESSAGE_TYPES}>
      <AuthenticationWait>
        <AuthenticationRedirect>
          <AuthenticationLayout passwordResetSent={passwordResetSent}>
            <Outlet />
          </AuthenticationLayout>
        </AuthenticationRedirect>
      </AuthenticationWait>
    </IntlMessagesRegistration>
  )
}
