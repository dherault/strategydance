import type { PropsWithChildren } from 'react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useOAuthAuthorizationRequest from '~hooks/oauth/useOAuthAuthorizationRequest'

import getOAuthConsentFailure from '~utils/oauth/getOAuthConsentFailure'

import Spinner from '~components/common/Spinner'
import OAuthConsentFailureNotice from '~components/oauth/OAuthConsentFailureNotice'

import globalMessages from '~data/intl/messages/global'
import moduleMessages from '~data/intl/messages/module'

type Props = PropsWithChildren<{
  requestId: string | undefined
}>

/*
  Lets the consent page show a request it read, and says why there is none otherwise: an address
  naming no request, or one unknown, decided or expired, alike, since an agent's link is all the
  member followed; an agent that could not be verified; or a read that failed, with a way to try
  again
*/
function OAuthConsentRequestBouncer({ requestId, children }: Props) {
  const { formatMessage } = useIntl()
  const { data: request, error, loading, refetch } = useOAuthAuthorizationRequest(requestId)

  if (request) return children

  const failure = error ? getOAuthConsentFailure(error) : 'expired'

  if (failure) return <OAuthConsentFailureNotice failure={failure} />

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert variant="danger">{formatMessage(moduleMessages.readError)}</Alert>
      <Button
        variant="outline"
        disabled={loading}
        icon={loading ? <Spinner tone="current" /> : undefined}
        onClick={refetch}
      >
        {formatMessage(globalMessages.retry)}
      </Button>
    </div>
  )
}

export default OAuthConsentRequestBouncer
