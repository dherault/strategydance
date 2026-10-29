import { SparklesIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import type { BillUploadRead } from '~hooks/budget/useBillUpload'

import budgetMessages from '~data/intl/messages/budget'

const MESSAGES = {
  capped: budgetMessages.receiptReadsCapped,
  unverified: budgetMessages.receiptReadUnverified,
  suspended: budgetMessages.receiptReadSuspended,
}

type Props = Pick<BillUploadRead, 'receipt' | 'outcome'>

/*
  What a new bill's form says above its fields once its receipt went up through the upload dialog:
  that Strategy Dance filled them in from it, to check before saving, or why it read nothing, the
  member filling the bill in themselves
*/
function BillReadNotice({ receipt, outcome }: Props) {
  const { formatMessage } = useIntl()

  if (outcome === 'filled') {
    return (
      <Alert
        variant="info"
        icon={<SparklesIcon />}
      >
        {formatMessage(budgetMessages.receiptFilled, { file: receipt.name })}
      </Alert>
    )
  }

  return <Alert variant="info">{formatMessage(MESSAGES[outcome])}</Alert>
}

export default BillReadNotice
