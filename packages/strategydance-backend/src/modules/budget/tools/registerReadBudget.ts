import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { BudgetToolContext } from '~types'

import readBudget from '~domain/budget/readBudget'

import { currencySchema, monthSchema, periodSchema, statusSchema } from '~modules/budget/budgetSchemas'
import toBudgetRefusal from '~modules/budget/toBudgetRefusal'
import toToolResult from '~modules/toToolResult'

const inputSchema = z.object({
  month: monthSchema.optional().describe("The month to read, as YYYY-MM, the member's current month by default"),
})

const periodSummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  spent: z.string(),
  expected: z.string(),
  limit: z.string().nullable(),
  left: z.string().nullable(),
  projectedLeft: z.string().nullable(),
})

const outputSchema = z.object({
  budget: z.object({ amount: z.string(), period: periodSchema, currency: currencySchema }).nullable(),
  currency: currencySchema,
  today: z.string(),
  ratesDate: z.string().nullable(),
  month: periodSummarySchema,
  quarter: periodSummarySchema,
  year: periodSummarySchema,
  status: statusSchema,
  missingRates: z.array(currencySchema),
})

// `read_budget`: the budget, and where a month, its quarter and its year stand against it
function registerReadBudget(server: McpServer, { caller }: BudgetToolContext) {
  server.registerTool(
    'read_budget',
    {
      title: 'Read the budget',
      description:
        "Reads the organization's budget, the amount an administrator means the company to spend a month, quarter or year, or null when none is set, and where a month, its quarter and its year stand against it on the member's today: what was spent until today, what the bills still expect after it, the limit for that stretch, what is left, and what will be once the expected bills are paid (`projectedLeft`). Every amount is a decimal string in `currency`, the budget's, each payment converted at its own day's rate, which `ratesDate` says how recent; a currency in `missingRates` has no rate yet, and its payments are left out of the sums. `status` says whether spending in the budget's own period is over its limit already or would pass it with what is expected, and by how much. Call it to answer how much is left, whether the company is over budget, or how a month went.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ month }) => {
      const read = await readBudget(caller, { month })

      if (read.outcome !== 'read') return toBudgetRefusal(read)

      return toToolResult(read.answer)
    },
  )
}

export default registerReadBudget
