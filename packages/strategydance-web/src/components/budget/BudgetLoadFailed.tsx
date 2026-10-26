import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import Spinner from '~components/common/Spinner'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  isRetrying: boolean
  onRetry: () => void
}

// What the Budget page shows in place of numbers it could not read: a way to try again, rather than
// a budget of nothing
function BudgetLoadFailed({ isRetrying, onRetry }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert
        variant="danger"
        className="max-w-xl"
      >
        {formatMessage(budgetMessages.loadFailed)}
      </Alert>
      <Button
        variant="outline"
        disabled={isRetrying}
        icon={isRetrying ? <Spinner tone="current" /> : undefined}
        onClick={onRetry}
      >
        {formatMessage(budgetMessages.retry)}
      </Button>
    </div>
  )
}

export default BudgetLoadFailed
