import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'

import readRedirectPath from '~utils/authentication/readRedirectPath'

/*
  A bouncer, under the name the thing it does goes by. Sits under `AuthenticationWait`, so a
  viewer of `null` here means signed out rather than not answered yet.

  Its job is the reverse of `AuthenticationBouncer`: it keeps somebody who is already signed in
  off the sign-in screens, which would otherwise offer to sign them in again. It sends them back
  to the page they were turned away from, like an invitation's link, which that bouncer kept, or
  to the app's home.

  An effect on the verdict rather than a `<Navigate>`, which navigates again whenever its props
  change. The kept page is read when the reader turns up signed in, and left kept: StrictMode runs
  the effect twice in development, and both runs have to go to the same place. The bouncer at the
  destination forgets it
*/
function AuthenticationRedirect({ children }: PropsWithChildren) {
  const { data: viewer } = useAuthentication()
  const navigate = useNavigate()

  useEffect(() => {
    if (!viewer) return

    /*
      `href` wins over `to` when both are given, the router reading the destination off it. The
      kept page is a path only known at runtime, which `to`'s route types cannot hold, so it goes
      there, and `to` is where the reader lands without one
    */
    navigate({
      to: '/today',
      href: readRedirectPath() ?? undefined,
      replace: true,
    })
  }, [navigate, viewer])

  if (viewer) return null

  return children
}

export default AuthenticationRedirect
