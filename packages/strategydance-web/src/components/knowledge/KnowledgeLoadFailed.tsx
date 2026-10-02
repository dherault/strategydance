import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import Spinner from '~components/common/Spinner'

import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = {
  message: ReactNode
  isRetrying: boolean
  onRetry: () => void
}

// What a knowledge page shows in place of what it could not read: a way to try again, rather than
// an empty list or a document that does not exist
function KnowledgeLoadFailed({ message, isRetrying, onRetry }: Props) {
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
        {formatMessage(knowledgeMessages.retry)}
      </Button>
    </div>
  )
}

export default KnowledgeLoadFailed
