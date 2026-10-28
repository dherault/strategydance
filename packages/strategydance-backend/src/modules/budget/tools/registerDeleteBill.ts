import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { BudgetToolContext } from '~types'

import deleteBill from '~domain/budget/deleteBill'

import budgetModule from '~modules/budget/budgetModule'
import { billIdSchema } from '~modules/budget/budgetSchemas'
import readBudgetWriteCall from '~modules/budget/readBudgetWriteCall'
import toBudgetRefusal from '~modules/budget/toBudgetRefusal'
import toBudgetWriteResult from '~modules/budget/toBudgetWriteResult'
import requireModuleWriteScope from '~modules/requireModuleWriteScope'

const TOOL = 'delete_bill'

const inputSchema = z.object({ id: billIdSchema.describe("The bill's id") })

const outputSchema = z.object({
  id: z.string(),
  restorableUntil: z.string(),
})

// `delete_bill`: a bill deleted as the Budget page's Delete does, restorable for a day
function registerDeleteBill(server: McpServer, context: BudgetToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Delete a bill',
      description:
        "Deletes a bill from the organization's budget, as the Budget page's Delete does, keeping its receipt. It can be restored by restore_bill for a day, until `restorableUntil`, then it is gone for good. Call it only when the member asks for the bill to go.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      scopeChallenge: requireModuleWriteScope(budgetModule),
    },
    async (args, serverContext) => {
      const prepared = readBudgetWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      // A reaction to subagents' reports deletes nothing: the member's answer starts the run that may.
      // Read only for a call from a run, whose read loads the conversation runtime
      if (context.caller.launcher) {
        const { default: isReactionCaller } = await import('~domain/subagents/isReactionCaller')

        if (await isReactionCaller(context.caller)) return toBudgetRefusal({ outcome: 'fromReaction' })
      }

      // A deleted bill's dialog shows nothing, so the answer carries no address
      return toBudgetWriteResult(await deleteBill(context.caller, args, prepared.call), null)
    },
  )
}

export default registerDeleteBill
