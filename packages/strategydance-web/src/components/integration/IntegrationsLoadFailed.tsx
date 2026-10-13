import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import Spinner from '~components/common/Spinner'

import globalMessages from '~data/intl/messages/global'
import integrationMessages from '~data/intl/messages/integration'

type Props = {
  isRetrying: boolean
  onRetry: () => void
}

// What the page shows in place of the servers when they could not be read: a way to try again,
// rather than an organization with none
function IntegrationsLoadFailed({ isRetrying, onRetry }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert
        variant="danger"
        className="max-w-xl"
      >
        {formatMessage(integrationMessages.loadError)}
      </Alert>
      <Button
        variant="outline"
        disabled={isRetrying}
        icon={isRetrying ? <Spinner tone="current" /> : undefined}
        onClick={onRetry}
      >
        {formatMessage(globalMessages.retry)}
      </Button>
    </div>
  )
}

export default IntegrationsLoadFailed
