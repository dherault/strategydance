import { ReceiptIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import budgetMessages from '~data/intl/messages/budget'

// The Bills tab with no bill, which is every organization's until bills can be added
function BudgetBillsEmpty() {
  const { formatMessage } = useIntl()

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <ReceiptIcon />
        </EmptyMedia>
        <EmptyTitle>{formatMessage(budgetMessages.billsEmptyTitle)}</EmptyTitle>
        <EmptyDescription>{formatMessage(budgetMessages.billsEmptyText)}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export default BudgetBillsEmpty
