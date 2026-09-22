import type { PropsWithChildren } from 'react'

import useUser from '~hooks/user/useUser'

import Loading from '~components/common/Loading'

// Sits below `AuthenticationBouncer`, which is the order that makes this one simple: by the
// time it renders there is certainly a viewer, so the only thing left to wait on is the row
// being read, or written for the first time
function UserWait({ children }: PropsWithChildren) {
  const { loading } = useUser()

  if (loading) {
    return (
      <Loading source="UserWait" />
    )
  }

  return children
}

export default UserWait
