import type { PropsWithChildren } from 'react'

import useCanUseModules from '~hooks/module/useCanUseModules'

import OAuthConsentFailureNotice from '~components/oauth/OAuthConsentFailureNotice'

/*
  Lets a reader who may connect agents see the request, and tells anybody else the page is not
  available yet: until modules launch, that is administrators of Strategy Dance alone. A screen
  rather than a redirect, since an agent sent them here and they would not know why they landed
  elsewhere. It decides before anything is read, so the backend fetches no client's document for
  a reader it would refuse.

  Nothing to wait for, since `UserWait` already has the reader's row
*/
function OAuthConsentReleaseBouncer({ children }: PropsWithChildren) {
  const canUseModules = useCanUseModules()

  if (!canUseModules) return <OAuthConsentFailureNotice failure="unavailable" />

  return children
}

export default OAuthConsentReleaseBouncer
