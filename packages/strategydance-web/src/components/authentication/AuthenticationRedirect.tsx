import { Navigate } from '@tanstack/react-router'
import type { PropsWithChildren } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'

type Props = PropsWithChildren<{
  // The page the reader was sent to sign in from, already checked to be one of the app's own
  redirect: string | null
}>

/*
  A bouncer, under the name the thing it does goes by. Sits under `AuthenticationWait`, so a
  viewer of `null` here means signed out rather than not answered yet.

  Its job is the reverse of `AuthenticationBouncer`: it keeps somebody who is already signed in
  off the sign-in screens, which would otherwise offer to sign them in again. It sends them back
  to the page they were turned away from, like an invitation's link, or to the app's home
*/
function AuthenticationRedirect({ redirect, children }: Props) {
  const { data: viewer } = useAuthentication()

  /*
    `href` wins over `to` when both are given, the router reading the destination off it. The
    redirect is a path only known at runtime, which `to`'s route types cannot hold, so it goes
    there, and `to` is where the reader lands without one
  */
  if (viewer) {
    return (
      <Navigate
        replace
        to="/-"
        href={redirect ?? undefined}
      />
    )
  }

  return children
}

export default AuthenticationRedirect
