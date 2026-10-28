import type { ServerContext } from '@modelcontextprotocol/server'

import type { BudgetToolContext } from '~types'

import budgetModule from '~modules/budget/budgetModule'
import toBudgetRefusal from '~modules/budget/toBudgetRefusal'
import readModuleWriteCall from '~modules/readModuleWriteCall'

// A write's idempotency key, after the write scope it needs, which a connection granted read alone
// lacks
function readBudgetWriteCall(context: BudgetToolContext, serverContext: ServerContext, tool: string, args: unknown) {
  return readModuleWriteCall(
    context.caller,
    { scope: budgetModule.scopes.write, readOnly: toBudgetRefusal({ outcome: 'readOnly' }) },
    serverContext,
    tool,
    args,
  )
}

export default readBudgetWriteCall
