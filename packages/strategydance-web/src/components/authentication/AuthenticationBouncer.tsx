import { Navigate } from '@tanstack/react-router'
import type { PropsWithChildren } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'

// Sits under `AuthenticationWait`, which is what makes the verdict readable: by the time this
// renders, a viewer of `null` means signed out rather than not answered yet
function AuthenticationBouncer({ children }: PropsWithChildren) {
  const { data: viewer } = useAuthentication()

  if (!viewer) {
    return (
      <Navigate
        replace
        to="/authentication"
      />
    )
  }

  return children
}

export default AuthenticationBouncer
