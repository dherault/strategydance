import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { BudgetToolContext } from '~types'

import restoreBill from '~domain/budget/restoreBill'

import budgetModule from '~modules/budget/budgetModule'
import { billIdSchema, billShape, currencySchema } from '~modules/budget/budgetSchemas'
import readBudgetWriteCall from '~modules/budget/readBudgetWriteCall'
import toBudgetWriteResult from '~modules/budget/toBudgetWriteResult'
import requireModuleWriteScope from '~modules/requireModuleWriteScope'

const TOOL = 'restore_bill'

const inputSchema = z.object({ id: billIdSchema.describe("The deleted bill's id") })

const outputSchema = z.object({
  ...billShape,
  budgetCurrency: currencySchema,
})

// `restore_bill`: a delete taken back, within a day of it
function registerRestoreBill(server: McpServer, context: BudgetToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Restore a bill',
      description:
        "Brings back a bill deleted within the last day, with its receipt, as the Budget page's Undo does. Answers the bill.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      scopeChallenge: requireModuleWriteScope(budgetModule),
    },
    async (args, serverContext) => {
      const prepared = readBudgetWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toBudgetWriteResult(await restoreBill(context.caller, args, prepared.call), context.toAddress)
    },
  )
}

export default registerRestoreBill
