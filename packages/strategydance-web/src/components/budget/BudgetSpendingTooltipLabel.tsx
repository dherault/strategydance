import { useIntl } from 'react-intl'

import type { BudgetChartMonth } from '~types'

import getBudgetChange from '~utils/budget/getBudgetChange'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  // The month hovered, as "Oct 2026"
  title: string
  month: BudgetChartMonth
  previous?: BudgetChartMonth
}

// The head of the chart's tooltip: the month and its year, and its change from the month before
function BudgetSpendingTooltipLabel({ title, month, previous }: Props) {
  const { formatMessage, formatNumber } = useIntl()
  const change = previous ? getBudgetChange(month.spent + month.expected, previous.spent + previous.expected) : null

  return (
    <span className="flex items-center justify-between gap-2">
      {title}
      {change === null ? null : (
        <span
          title={formatMessage(budgetMessages.comparedWithMonth, { month: previous!.name })}
          className="font-medium text-muted-foreground"
        >
          {formatNumber(change / 100, { style: 'percent', signDisplay: 'exceptZero' })}
        </span>
      )}
    </span>
  )
}

export default BudgetSpendingTooltipLabel
