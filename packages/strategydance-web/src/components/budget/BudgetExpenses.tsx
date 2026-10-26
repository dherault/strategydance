import { useIntl } from 'react-intl'

import useBudgetSummary from '~hooks/budget/useBudgetSummary'

import BudgetAlerts from '~components/budget/BudgetAlerts'
import BudgetChartLegend from '~components/budget/BudgetChartLegend'
import BudgetCompaniesPanel from '~components/budget/BudgetCompaniesPanel'
import BudgetSpendingChart from '~components/budget/BudgetSpendingChart'
import BudgetStats from '~components/budget/BudgetStats'
import BudgetUpcomingPanel from '~components/budget/BudgetUpcomingPanel'
import PageSection from '~components/layout/PageSection'

import budgetMessages from '~data/intl/messages/budget'

/*
  The Expenses tab: what the company spent and is expected to spend, in the budget's currency, on
  the browser's today. A currency with no rate yet is named under the numbers, which leave its
  payments out rather than convert them at a wrong rate
*/
function BudgetExpenses() {
  const { formatMessage, formatList } = useIntl()
  const { summary, bills, limit, currency, today, rates } = useBudgetSummary()
  const year = Number(today.slice(0, 4))

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
      <PageSection
        title={formatMessage(budgetMessages.spendingIn, { year })}
        actions={<BudgetChartLegend hasBudget={summary.monthlyLimit !== null} />}
        headClassName="flex-wrap"
      >
        <BudgetSpendingChart
          months={summary.months}
          monthlyLimit={summary.monthlyLimit}
          currency={currency}
          year={year}
        />
      </PageSection>
      <div className="-mx-4 grid grid-cols-2 gap-8 @max-[760px]:mx-0 @max-[760px]:grid-cols-1 @max-[760px]:gap-4">
        <BudgetUpcomingPanel
          bills={bills}
          currency={currency}
          today={today}
          rates={rates}
        />
        <BudgetCompaniesPanel
          bills={bills}
          currency={currency}
          today={today}
          rates={rates}
        />
      </div>
    </div>
  )
}

export default BudgetExpenses
