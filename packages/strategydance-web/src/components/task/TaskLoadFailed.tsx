import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import Spinner from '~components/common/Spinner'

import taskMessages from '~data/intl/messages/task'

type Props = {
  message: ReactNode
  isRetrying: boolean
  onRetry: () => void
}

// What the Tasks page shows in place of a board it could not read: a way to try again, rather than
// an empty board
function TaskLoadFailed({ message, isRetrying, onRetry }: Props) {
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
        {formatMessage(taskMessages.retry)}
      </Button>
    </div>
  )
}

export default TaskLoadFailed
