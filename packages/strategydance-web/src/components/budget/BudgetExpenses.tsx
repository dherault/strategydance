import { useIntl } from 'react-intl'

import useBudgetSummary from '~hooks/budget/useBudgetSummary'

import BudgetAlerts from '~components/budget/BudgetAlerts'
import BudgetStats from '~components/budget/BudgetStats'

import budgetMessages from '~data/intl/messages/budget'

/*
  The Expenses tab: what the company spent and is expected to spend, in the budget's currency, on
  the browser's today. A currency with no rate yet is named under the numbers, which leave its
  payments out rather than convert them at a wrong rate
*/
function BudgetExpenses() {
  const { formatMessage, formatList } = useIntl()
  const { summary, limit, currency, today } = useBudgetSummary()

  return (
    <div className="flex flex-col gap-8">
      <BudgetAlerts
        status={summary.status}
        limit={limit}
        currency={currency}
      />
      <div className="flex flex-col gap-2">
        <BudgetStats
          summary={summary}
          currency={currency}
          today={today}
        />
        {summary.missingRates.length ? (
          <p className="m-0 text-sm text-muted-foreground">
            {formatMessage(budgetMessages.missingRates, {
              currencies: formatList(summary.missingRates, { type: 'conjunction' }),
            })}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default BudgetExpenses
