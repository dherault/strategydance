import { Navigate } from '@tanstack/react-router'
import type { PropsWithChildren } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'

/*
  A bouncer, under the name the thing it does goes by. Sits under `AuthenticationWait`, so a
  viewer of `null` here means signed out rather than not answered yet.

  Its job is the reverse of `AuthenticationBouncer`: it keeps somebody who is already signed in
  off the sign-in screens, which would otherwise offer to sign them in again
*/
function AuthenticationRedirect({ children }: PropsWithChildren) {
  const { data: viewer } = useAuthentication()

  if (viewer) {
    return (
      <Navigate
        replace
        to="/-"
      />
    )
  }

  return children
}

export default AuthenticationRedirect
