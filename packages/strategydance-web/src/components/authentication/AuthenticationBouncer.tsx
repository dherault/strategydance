import { useNavigate, useRouter } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'

import forgetRedirectPath from '~utils/authentication/forgetRedirectPath'
import isAuthenticationPath from '~utils/authentication/isAuthenticationPath'
import keepRedirectPath from '~utils/authentication/keepRedirectPath'

/*
  Sits under `AuthenticationWait`, which is what makes the verdict readable: by the time this
  renders, a viewer of `null` means signed out rather than not answered yet. It guards the
  authenticated area and `/prologue`.

  The page asked for is kept in the browser's storage before the reader is sent to sign in, and
  the sign-in screen returns there once they are in, so a link into the app, an invitation's above
  all, survives having to sign in first. Every page the sign-in screen sends somebody to mounts
  this bouncer, so a signed-in reader reaching one is where the kept page is spent, and forgotten
  before it can send whoever signs in next somewhere they never asked for.

  An effect on the verdict rather than a `<Navigate>`, and the location read off the router
  inside it rather than subscribed to. The location moves to the sign-in screen while this is
  still mounted, and a `<Navigate>` navigates again whenever its props change: following the
  location, it redirected to its own redirect until the tab gave out
*/
function AuthenticationBouncer({ children }: PropsWithChildren) {
  const { data: viewer } = useAuthentication()
  const router = useRouter()
  const navigate = useNavigate()

  useEffect(() => {
    if (viewer) {
      forgetRedirectPath()

      return
    }

    const { pathname, href } = router.state.location

    // Already on its way out: StrictMode runs this twice in development, and the second run
    // reads the location the first one moved to the sign-in screen
    if (isAuthenticationPath(pathname)) return

    keepRedirectPath(href)
    navigate({
      to: '/authentication',
      replace: true,
    })
  }, [navigate, router, viewer])

  if (!viewer) return null

  return children
}

export default AuthenticationBouncer
