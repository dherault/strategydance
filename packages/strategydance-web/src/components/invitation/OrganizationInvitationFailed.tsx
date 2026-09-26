import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import Spinner from '~components/common/Spinner'

import invitationMessages from '~data/intl/messages/invitation'

type Props = {
  isRetrying: boolean
  onRetry: () => void
}

// What the invitation page shows when reading the invitation failed: a way to try again, and no
// claim about whether the invitation still exists
function OrganizationInvitationFailed({ isRetrying, onRetry }: Props) {
  const { formatMessage } = useIntl()

  return (
    <>
      <Alert
        variant="danger"
        className="max-w-xl"
      >
        {formatMessage(invitationMessages.loadError)}
      </Alert>
      <div>
        <Button
          variant="outline"
          disabled={isRetrying}
          icon={isRetrying ? <Spinner tone="current" /> : undefined}
          onClick={onRetry}
        >
          {formatMessage(invitationMessages.retry)}
        </Button>
      </div>
    </>
  )
}

export default OrganizationInvitationFailed
