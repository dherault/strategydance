import type { PropsWithChildren } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'

import Loading from '~components/common/Loading'

// Sits above every bouncer that reads the same data, which is the whole of its job: the
// verdict "not signed in" and the state "has not answered yet" are the same `null` otherwise
function AuthenticationWait({ children }: PropsWithChildren) {
  const { loading } = useAuthentication()

  if (loading) {
    return (
      <Loading source="AuthenticationWait" />
    )
  }

  return children
}

export default AuthenticationWait
