import { type Currency, listExchangeRateYears, summarizeBudget } from 'strategydance-core'

import type { AgentBill, BudgetState, ModuleBill, ModuleBudgetStatus } from '~types'

import readBudgetRates from '~domain/budget/readBudgetRates'
import toModuleBill from '~domain/budget/toModuleBill'
import toModuleBudgetStatus from '~domain/budget/toModuleBudgetStatus'

// What adding or saving a bill answers: the bill, and where spending stands once it is written
export type WrittenBill = ModuleBill & {
  budgetCurrency: Currency
  status: ModuleBudgetStatus | null
}

/*
  A bill an agent adds or saves, as the module answers it, with the budget's status at the member's
  today among `bills`, the live bills as they will be once it is written, so the agent hears at once
  that a bill tipped a period over its limit
*/
async function toWrittenBill(bill: AgentBill, state: BudgetState, bills: readonly AgentBill[]): Promise<WrittenBill> {
  const { budget, currency, today } = state
  const { rates } = await readBudgetRates(
    bills.map(other => other.currency),
    listExchangeRateYears(bills, today),
    currency,
  )

  return {
    ...toModuleBill(bill, { currency, today, rates }),
    budgetCurrency: currency,
    status: toModuleBudgetStatus(summarizeBudget({ bills, budget, currency, today, rates }).status, currency),
  }
}

export default toWrittenBill
