import { RepeatIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import budgetMessages from '~data/intl/messages/budget'

// "Next 30 days" with nothing to pay in them
function BudgetUpcomingEmpty() {
  const { formatMessage } = useIntl()

  return (
    <Empty size="sm">
      <EmptyHeader>
        <EmptyMedia>
          <RepeatIcon />
        </EmptyMedia>
        <EmptyTitle>{formatMessage(budgetMessages.nothingExpected)}</EmptyTitle>
        <EmptyDescription>{formatMessage(budgetMessages.nothingExpectedText)}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export default BudgetUpcomingEmpty
