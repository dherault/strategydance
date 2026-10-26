import type { CSSProperties } from 'react'
import { useIntl } from 'react-intl'
import type { Currency } from 'strategydance-core'

import type { BudgetChartMonth } from '~types'

import formatBudgetAmount from '~utils/budget/formatBudgetAmount'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  name: string
  // In minor units
  value: number
  month: BudgetChartMonth
  // The monthly limit in minor units, or null without a budget
  limit: number | null
  currency: Currency
}

/*
  One row of the chart's tooltip, its key and its amount, and after the last one, with a budget,
  how far the month is over or under it, below a rule
*/
function BudgetSpendingTooltipRow({ name, value, month, limit, currency }: Props) {
  const { formatMessage, locale } = useIntl()
  const isLast = name === 'nothing' || name === 'expected' || month.expected === 0
  const total = month.spent + month.expected

  return (
    <>
      {name === 'nothing' ? (
        <span className="text-muted-foreground">{formatMessage(budgetMessages.nothingYet)}</span>
      ) : (
        <>
          <span
            className="size-2 shrink-0 rounded-[2px] bg-(--color-bg)"
            style={{ '--color-bg': `var(--color-${name})` } as CSSProperties}
          />
          <span className="text-muted-foreground">
            {formatMessage(name === 'spent' ? budgetMessages.legendSpent : budgetMessages.legendExpected)}
          </span>
          <span className="ml-auto font-medium text-secondary">{formatBudgetAmount(value, currency, locale)}</span>
        </>
      )}
      {isLast && limit !== null ? (
        <span className="mt-0.5 flex basis-full items-center gap-2 border-t border-neutral-100 pt-1.5">
          <span className="text-muted-foreground">
            {formatMessage(total > limit ? budgetMessages.overBudgetBy : budgetMessages.underBudgetBy)}
          </span>
          <span className="ml-auto font-medium text-secondary">
            {formatBudgetAmount(Math.abs(limit - total), currency, locale)}
          </span>
        </span>
      ) : null}
    </>
  )
}

export default BudgetSpendingTooltipRow
