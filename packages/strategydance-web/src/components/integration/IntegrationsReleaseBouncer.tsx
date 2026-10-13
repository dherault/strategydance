import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useCanUseIntegrations from '~hooks/integration/useCanUseIntegrations'

/*
  Lets a reader who may see the integrations into their page, and sends anybody else to today, as
  if the page were not there: until conversations launch, that is administrators of Strategy Dance
  alone. Mounted outside the page's catalogues, so a reader turned away never loads them.

  Nothing to wait for, since `UserWait` already has the reader's row. An effect on the verdict
  rather than a `<Navigate>`, as in `ConversationsReleaseBouncer`
*/
function IntegrationsReleaseBouncer({ children }: PropsWithChildren) {
  const canUseIntegrations = useCanUseIntegrations()
  const navigate = useNavigate()

  useEffect(() => {
    if (canUseIntegrations) return

    navigate({
      to: '/today',
      replace: true,
    })
  }, [canUseIntegrations, navigate])

  if (!canUseIntegrations) return null

  return children
}

export default IntegrationsReleaseBouncer
