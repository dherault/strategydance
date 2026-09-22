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
    The key is omitted rather than set to false when it is absent. TanStack rewrites the URL to
    whatever this returns, so emitting the key unconditionally turns a plain `/authentication`
    into a redirect to `/authentication?passwordResetSent=false`
  */
  validateSearch: (search: Record<string, unknown>): AuthenticationSearch => {
    if (search.passwordResetSent === true || search.passwordResetSent === 'true') return { passwordResetSent: true }

    return {}
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
