import budgetModule from '~modules/budget/budgetModule'
import toBudgetRefusal from '~modules/budget/toBudgetRefusal'
import createModuleWriteCallReader from '~modules/createModuleWriteCallReader'

// A write's idempotency key, after the write scope it needs, which a connection granted read alone
// lacks
const readBudgetWriteCall = createModuleWriteCallReader(budgetModule.scopes.write, toBudgetRefusal)

export default readBudgetWriteCall
