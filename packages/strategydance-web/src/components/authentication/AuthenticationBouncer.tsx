import { useNavigate, useRouter } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'

import isAuthenticationPath from '~utils/authentication/isAuthenticationPath'

/*
  Sits under `AuthenticationWait`, which is what makes the verdict readable: by the time this
  renders, a viewer of `null` means signed out rather than not answered yet. It guards the
  authenticated area and `/prologue`.

  The page asked for rides along to the sign-in screen, which returns there once the reader is
  in, so a link into the app, an invitation's above all, survives having to sign in first. The
  sign-in screen drops `/prologue` as a place to return to, and needs no other: the app sends
  whoever belongs to no organization back there.

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
    if (viewer) return

    const { pathname, href } = router.state.location

    // Already on its way out: StrictMode runs this twice in development, and the second run
    // reads the location the first one moved to the sign-in screen
    if (isAuthenticationPath(pathname)) return

    navigate({
      to: '/authentication',
      search: { redirect: href },
      replace: true,
    })
  }, [
    navigate,
    router,
    viewer,
  ])

  if (!viewer) return null

  return children
}

export default AuthenticationBouncer
