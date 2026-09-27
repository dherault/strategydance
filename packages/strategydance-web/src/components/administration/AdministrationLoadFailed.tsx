import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import Spinner from '~components/common/Spinner'

import globalMessages from '~data/intl/messages/global'

type Props = {
  message: string
  isRetrying: boolean
  onRetry: () => void
}

// What an administration page shows in place of its table when the list could not be read: a
// way to try again, rather than a list of nothing
function AdministrationLoadFailed({ message, isRetrying, onRetry }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert
        variant="danger"
        className="max-w-xl"
      >
        {message}
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

export default AdministrationLoadFailed
