import { type MessageDescriptor, useIntl } from 'react-intl'
import type { BudgetSummary, Currency } from 'strategydance-core'

import formatBudgetAmount from '~utils/budget/formatBudgetAmount'
import formatBudgetDay from '~utils/budget/formatBudgetDay'

import BudgetStat from '~components/budget/BudgetStat'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  summary: BudgetSummary
  currency: Currency
  today: string
}

/*
  The Expenses tab's four numbers, this month, next month, this year and the year projected, each
  against the budget's limit for its span and compared with the span before it. Four columns, two
  below 820px of the page, one below 420px
*/
function BudgetStats({ summary, currency, today }: Props) {
  const { formatMessage, locale } = useIntl()
  const { month, next, year, monthlyLimit, yearlyLimit, recurringCount, previous } = summary
  const currentYear = today.slice(0, 4)

  function format(minor: number) {
    return formatBudgetAmount(minor, currency, locale)
  }

  function formatOver(message: MessageDescriptor, minor: number) {
    return formatMessage(message, { amount: format(minor) })
  }

  const monthTotal = month.spent + month.expected
  const yearTotal = year.spent + year.expected

  return (
    <div className="grid grid-cols-4 gap-y-3 @max-[820px]:grid-cols-2 @max-[420px]:grid-cols-1">
      <BudgetStat
        label={formatMessage(budgetMessages.thisMonth)}
        value={format(month.spent)}
        comparison={{
          value: month.spent,
          base: previous.monthToDate,
          title: formatMessage(budgetMessages.comparedWithSameDaysLastMonth),
        }}
        bar={monthlyLimit === null ? null : { spent: month.spent, expected: month.expected, limit: monthlyLimit }}
        foot={
          month.expected > 0
            ? formatMessage(budgetMessages.expectedAmount, { amount: format(month.expected) })
            : formatMessage(budgetMessages.nothingElseExpected)
        }
        over={
          monthlyLimit !== null && monthTotal > monthlyLimit
            ? formatOver(
                month.spent > monthlyLimit ? budgetMessages.overThisMonth : budgetMessages.overThisMonthExpected,
                monthTotal - monthlyLimit,
              )
            : null
        }
      />
      <BudgetStat
        label={formatMessage(budgetMessages.nextMonth)}
        value={format(next)}
        comparison={{ value: next, base: monthTotal, title: formatMessage(budgetMessages.comparedWithThisMonth) }}
        bar={monthlyLimit === null ? null : { spent: next, expected: null, limit: monthlyLimit }}
        foot={formatMessage(budgetMessages.recurringBills, { count: recurringCount })}
        over={
          monthlyLimit !== null && next > monthlyLimit
            ? formatOver(budgetMessages.overNextMonth, next - monthlyLimit)
            : null
        }
      />
      <BudgetStat
        label={formatMessage(budgetMessages.thisYear)}
        value={format(year.spent)}
        comparison={{
          value: year.spent,
          base: previous.yearToDate,
          title: formatMessage(budgetMessages.comparedWithSamePeriodLastYear),
        }}
        bar={yearlyLimit === null ? null : { spent: year.spent, expected: null, limit: yearlyLimit }}
        foot={formatMessage(budgetMessages.spentSince, {
          date: formatBudgetDay(`${currentYear}-01-01`, today, locale),
        })}
        over={
          yearlyLimit !== null && year.spent > yearlyLimit
            ? formatOver(budgetMessages.overThisYear, year.spent - yearlyLimit)
            : null
        }
      />
      <BudgetStat
        label={formatMessage(budgetMessages.projectedThisYear)}
        value={format(yearTotal)}
        comparison={{
          value: yearTotal,
          base: previous.lastYear,
          title: formatMessage(budgetMessages.comparedWithLastYear),
        }}
        bar={yearlyLimit === null ? null : { spent: year.spent, expected: year.expected, limit: yearlyLimit }}
        foot={formatMessage(budgetMessages.expectedBy, {
          amount: format(year.expected),
          date: formatBudgetDay(`${currentYear}-12-31`, today, locale),
        })}
        over={
          yearlyLimit !== null && yearTotal > yearlyLimit
            ? formatOver(budgetMessages.overThisYearExpected, yearTotal - yearlyLimit)
            : null
        }
      />
    </div>
  )
}

export default BudgetStats
