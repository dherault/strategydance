import { Outlet, createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import AuthenticationLayout from '~components/authentication/AuthenticationLayout'
import AuthenticationRedirect from '~components/authentication/AuthenticationRedirect'
import AuthenticationWait from '~components/authentication/AuthenticationWait'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

import parseRedirectPath from '~utils/authentication/parseRedirectPath'

// At module scope so the reference is stable across renders
const AUTHENTICATION_MESSAGE_TYPES: MessageType[] = ['authentication']

type AuthenticationSearch = {
  passwordResetSent?: boolean
  // The page the reader was sent here from, to return to once signed in
  redirect?: string
}

export const Route = createFileRoute('/authentication')({
  /*
    `passwordResetSent` is omitted rather than set to false when it is absent. TanStack rewrites
    the URL to whatever this returns, so emitting it unconditionally turns a plain
    `/authentication` into a redirect to `/authentication?passwordResetSent=false`.

    `redirect` is the opposite case, and is always set, to undefined when it does not check out.
    TanStack lays what this returns over the raw query rather than replacing it, so a key merely
    left out keeps its raw value in `useSearch()`, and a hostile path would be followed after
    all. Undefined overwrites it, and drops it from the URL
  */
  validateSearch: (search: Record<string, unknown>): AuthenticationSearch => {
    const validated: AuthenticationSearch = {
      redirect: parseRedirectPath(search.redirect) ?? undefined,
    }

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
  const { passwordResetSent, redirect } = Route.useSearch()

  return (
    <IntlMessagesRegistration messageTypes={AUTHENTICATION_MESSAGE_TYPES}>
      <AuthenticationWait>
        <AuthenticationRedirect redirect={redirect ?? null}>
          <AuthenticationLayout passwordResetSent={passwordResetSent}>
            <Outlet />
          </AuthenticationLayout>
        </AuthenticationRedirect>
      </AuthenticationWait>
    </IntlMessagesRegistration>
  )
}
