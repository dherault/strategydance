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

type Props = {
  year: number
}

// "By company" with nothing paid this year yet
function BudgetCompaniesEmpty({ year }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Empty size="sm">
      <EmptyHeader>
        <EmptyMedia>
          <WalletIcon />
        </EmptyMedia>
        <EmptyTitle>{formatMessage(budgetMessages.noSpendingYet)}</EmptyTitle>
        <EmptyDescription>{formatMessage(budgetMessages.noSpendingYetText, { year })}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export default BudgetCompaniesEmpty
