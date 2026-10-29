import {
  type BudgetPeriodSummary,
  type Currency,
  formatMoneyAmount,
  listExchangeRateYears,
  summarizeBudget,
  summarizeBudgetPeriod,
} from 'strategydance-core'

import type { BudgetRefusal, ModuleBudget, ModuleBudgetStatus, ModuleCaller } from '~types'

import readBudgetRates from '~domain/budget/readBudgetRates'
import readBudgetState from '~domain/budget/readBudgetState'
import toModuleBudgetStatus from '~domain/budget/toModuleBudgetStatus'

// A month, a quarter or a year as `read_budget` answers it, its amounts decimal strings
type ModuleBudgetPeriod = {
  from: string
  to: string
  spent: string
  expected: string
  limit: string | null
  left: string | null
  projectedLeft: string | null
}

export type ReadBudgetAnswer = {
  budget: ModuleBudget | null
  currency: Currency
  today: string
  ratesDate: string | null
  month: ModuleBudgetPeriod
  quarter: ModuleBudgetPeriod
  year: ModuleBudgetPeriod
  status: ModuleBudgetStatus | null
  missingRates: Currency[]
}

type ReadBudgetResult = { outcome: 'read'; answer: ReadBudgetAnswer } | BudgetRefusal

/*
  The budget and where a month stands against it, its quarter's and its year's too, on the member's
  today, as the page computes them: what was spent until today and what is expected after it, the
  limit, what is left and what will be once the expected bills are paid, every amount in the budget's
  currency. With the status at today, in the budget's own period, and the currencies some payment
  could not be converted from, which the sums leave out. The month is today's unless one is asked for
*/
async function readBudget(caller: ModuleCaller, { month }: { month?: string }): Promise<ReadBudgetResult> {
  const read = await readBudgetState(caller)

  if (read.outcome !== 'read') return read

  const { budget, currency, bills, today } = read.state
  const asked = month ?? today.slice(0, 7)
  const year = Number(asked.slice(0, 4))
  // The page's years, and the month's own, with the year before for a payment on January 1
  const years = [...listExchangeRateYears(bills, today), year - 1, year]
  const { rates, ratesDate } = await readBudgetRates(
    bills.map(bill => bill.currency),
    years,
    currency,
  )
  const computation = { bills, budget, currency, today, rates }
  const periods = summarizeBudgetPeriod({ ...computation, month: asked })
  const summary = summarizeBudget(computation)
  const toPeriod = (period: BudgetPeriodSummary) => toModuleBudgetPeriod(period, currency)

  return {
    outcome: 'read',
    answer: {
      budget: budget
        ? { amount: formatMoneyAmount(budget.amountMinor, currency), period: budget.period, currency }
        : null,
      currency,
      today,
      ratesDate,
      month: toPeriod(periods.month),
      quarter: toPeriod(periods.quarter),
      year: toPeriod(periods.year),
      status: toModuleBudgetStatus(summary.status, currency),
      missingRates: [...new Set([...periods.missingRates, ...summary.missingRates])].sort(),
    },
  }
}

function toModuleBudgetPeriod(period: BudgetPeriodSummary, currency: Currency): ModuleBudgetPeriod {
  const format = (amount: number | null) => (amount === null ? null : formatMoneyAmount(amount, currency))

  return {
    from: period.from,
    to: period.to,
    spent: formatMoneyAmount(period.spent, currency),
    expected: formatMoneyAmount(period.expected, currency),
    limit: format(period.limit),
    left: format(period.left),
    projectedLeft: format(period.projectedLeft),
  }
}

export default readBudget
