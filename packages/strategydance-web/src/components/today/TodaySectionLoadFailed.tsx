import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import Spinner from '~components/common/Spinner'

import todayMessages from '~data/intl/messages/today'

type Props = {
  message: string
  isRetrying: boolean
  onRetry: () => void
}

// What a section of the Today page shows in place of what it could not read: a way to try again,
// rather than an empty section that reads as nothing to show
function TodaySectionLoadFailed({ message, isRetrying, onRetry }: Props) {
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
        {formatMessage(todayMessages.retry)}
      </Button>
    </div>
  )
}

export default TodaySectionLoadFailed
