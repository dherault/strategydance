import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import Spinner from '~components/common/Spinner'

import teamMessages from '~data/intl/messages/team'

type Props = {
  isRetrying: boolean
  onRetry: () => void
}

// What the team page shows in place of the table when the team could not be read: a way to try
// again, rather than a team of nobody
function TeamLoadFailed({ isRetrying, onRetry }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert
        variant="danger"
        className="max-w-xl"
      >
        {formatMessage(teamMessages.loadError)}
      </Alert>
      <Button
        variant="outline"
        disabled={isRetrying}
        icon={isRetrying ? <Spinner tone="current" /> : undefined}
        onClick={onRetry}
      >
        {formatMessage(teamMessages.retry)}
      </Button>
    </div>
  )
}

export default TeamLoadFailed
