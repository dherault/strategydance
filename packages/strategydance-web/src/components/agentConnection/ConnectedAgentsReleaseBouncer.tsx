import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useCanUseModules from '~hooks/module/useCanUseModules'

/*
  Lets a reader who may connect agents into the account page's Connected agents tab, and sends
  anybody else to the account's first tab, as if this one were not there: until modules launch,
  that is administrators of Strategy Dance alone.

  Nothing to wait for, since `UserWait` already has the reader's row. An effect on the verdict
  rather than a `<Navigate>`, as in `AuthenticationBouncer`
*/
function ConnectedAgentsReleaseBouncer({ children }: PropsWithChildren) {
  const canUseModules = useCanUseModules()
  const navigate = useNavigate()

  useEffect(() => {
    if (canUseModules) return

    navigate({
      to: '/account',
      replace: true,
    })
  }, [canUseModules, navigate])

  if (!canUseModules) return null

  return children
}

export default ConnectedAgentsReleaseBouncer
