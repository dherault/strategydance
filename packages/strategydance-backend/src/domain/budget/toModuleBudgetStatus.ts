import { type BudgetStatus, type Currency, formatMoneyAmount } from 'strategydance-core'

import type { ModuleBudgetStatus } from '~types'

// Where spending stands against the budget, its amounts as decimal strings in the budget's currency
function toModuleBudgetStatus(status: BudgetStatus | null, currency: Currency): ModuleBudgetStatus | null {
  if (!status) return null

  return {
    level: status.level,
    scope: status.scope,
    by: formatMoneyAmount(status.by, currency),
    limit: formatMoneyAmount(status.limit, currency),
    expected: formatMoneyAmount(status.expected, currency),
  }
}

export default toModuleBudgetStatus
