import {
  type BudgetBill,
  type BudgetLimit,
  type Currency,
  type ExchangeRateTable,
  summarizeBudget,
} from 'strategydance-core'

type Props = {
  // The bills as they stood before the save
  bills: readonly BudgetBill[]
  // The bill saved, new or replacing the one with its id
  bill: BudgetBill
  budget: BudgetLimit | null
  currency: Currency
  today: string
  rates: ExchangeRateTable
}

/*
  Whether saving a bill takes spending over the budget in its own period, where it was not before:
  what the bill's dialog warns of once the save went through. A bill in a currency with no rate yet
  counts for nothing, as it does on the page, so it warns of nothing
*/
function isPushedOverBudget({ bills, bill, budget, currency, today, rates }: Props) {
  const before = summarizeBudget({ bills, budget, currency, today, rates }).status
  const after = summarizeBudget({
    bills: [...bills.filter(({ id }) => id !== bill.id), bill],
    budget,
    currency,
    today,
    rates,
  }).status

  return before?.level !== 'over' && after?.level === 'over'
}

export default isPushedOverBudget
