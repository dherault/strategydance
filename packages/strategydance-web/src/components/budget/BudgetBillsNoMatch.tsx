import { SearchIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  onClear: () => void
}

// The Bills tab once its search and its filter by payer leave no bill, with a way back to them all
function BudgetBillsNoMatch({ onClear }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <SearchIcon />
        </EmptyMedia>
        <EmptyTitle>{formatMessage(budgetMessages.billsNoMatchTitle)}</EmptyTitle>
        <EmptyDescription>{formatMessage(budgetMessages.billsNoMatchText)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
        >
          {formatMessage(budgetMessages.clearFilters)}
        </Button>
      </EmptyContent>
    </Empty>
  )
}

export default BudgetBillsNoMatch
