import { useIntl } from 'react-intl'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  hasBudget: boolean
}

// The key to the chart's lines: spent solid, expected dashed, and the monthly budget in black when
// there is one
function BudgetChartLegend({ hasBudget }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3.5 border-t-2 border-primary" />
        {formatMessage(budgetMessages.legendSpent)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3.5 border-t-2 border-dashed border-primary opacity-70" />
        {formatMessage(budgetMessages.legendExpected)}
      </span>
      {hasBudget ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 border-t-2 border-black" />
          {formatMessage(budgetMessages.legendMonthlyBudget)}
        </span>
      ) : null}
    </div>
  )
}

export default BudgetChartLegend
