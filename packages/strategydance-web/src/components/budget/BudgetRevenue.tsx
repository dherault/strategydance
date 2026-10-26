import { WalletIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import budgetMessages from '~data/intl/messages/budget'

// The Revenue tab, which says what it will hold until the company's earnings are read
function BudgetRevenue() {
  const { formatMessage } = useIntl()

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <WalletIcon />
        </EmptyMedia>
        <EmptyTitle>{formatMessage(budgetMessages.revenueTitle)}</EmptyTitle>
        <EmptyDescription>{formatMessage(budgetMessages.revenueText)}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export default BudgetRevenue
