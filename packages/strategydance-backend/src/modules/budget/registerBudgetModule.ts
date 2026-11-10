import type { McpServer } from '@modelcontextprotocol/server'

import type { ModuleAccess } from '~types'

import BUDGET_TOOLS from '~modules/budget/budgetTools'
import createModuleToolRegistrar from '~modules/createModuleToolRegistrar'

/*
  Registers the Budget module's tools, in their frozen order, on a server built for one access, whose
  caller every tool acts as, in the organization its call acts in
*/
function registerBudgetModule(server: McpServer, access: ModuleAccess) {
  const registerTool = createModuleToolRegistrar(server, access, 'budget')

  for (const register of BUDGET_TOOLS) register(registerTool)
}

export default registerBudgetModule
