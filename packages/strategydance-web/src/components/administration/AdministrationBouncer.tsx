import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useUser from '~hooks/user/useUser'

/*
  Lets an administrator of Strategy Dance into the administration pages, and sends anybody else
  to today, as if the pages were not there. Their queries refuse such a reader anyway: this keeps
  them from a page that could never load, and from learning it exists.

  Nothing to wait for: `UserWait` holds the whole authenticated area until the reader's row, and
  the flag with it, has arrived. An effect on the verdict rather than a `<Navigate>`, as in
  `AuthenticationBouncer`
*/
function AdministrationBouncer({ children }: PropsWithChildren) {
  const { data: user } = useUser()
  const navigate = useNavigate()

  const isAdministrator = user?.isAdministrator ?? false

  useEffect(() => {
    if (isAdministrator) return

    navigate({
      to: '/-/today',
      replace: true,
    })
  }, [
    isAdministrator,
    navigate,
  ])

  if (!isAdministrator) return null

  return children
}

export default AdministrationBouncer
