import registerAddBill from '~modules/budget/tools/registerAddBill'
import registerDeleteBill from '~modules/budget/tools/registerDeleteBill'
import registerListBills from '~modules/budget/tools/registerListBills'
import registerReadBill from '~modules/budget/tools/registerReadBill'
import registerReadBudget from '~modules/budget/tools/registerReadBudget'
import registerRestoreBill from '~modules/budget/tools/registerRestoreBill'
import registerUpdateBill from '~modules/budget/tools/registerUpdateBill'

/*
  The Budget module's tools, in the order `tools/list` gives them: reads, then writes. Reordering them
  changes that list, which costs every conversation its earlier reasoning once, the day Strategy
  Dance's agent lists them
*/
const BUDGET_TOOLS = [
  registerReadBudget,
  registerListBills,
  registerReadBill,
  registerAddBill,
  registerUpdateBill,
  registerDeleteBill,
  registerRestoreBill,
]

export default BUDGET_TOOLS
