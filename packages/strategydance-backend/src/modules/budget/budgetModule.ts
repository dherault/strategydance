import { MODULES } from 'strategydance-core'

function findBudgetModule() {
  const found = MODULES.find(module => module.name === 'budget')

  if (!found) throw new Error('MODULES lists no budget module')

  return found
}

// The Budget module's entry in `MODULES`: its name, path, title and scopes
const budgetModule = findBudgetModule()

export default budgetModule
