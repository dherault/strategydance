import type { PropsWithChildren } from 'react'

import useOAuthAuthorizationRequest from '~hooks/oauth/useOAuthAuthorizationRequest'

import Loading from '~components/common/Loading'

type Props = PropsWithChildren<{
  requestId: string | undefined
}>

// Holds the consent page until the agent's request is read, or its read refused
function OAuthConsentRequestWait({ requestId, children }: Props) {
  const { initialLoading } = useOAuthAuthorizationRequest(requestId)

  if (initialLoading) {
    return <Loading source="OAuthConsentRequestWait" />
  }

  return children
}

export default OAuthConsentRequestWait
