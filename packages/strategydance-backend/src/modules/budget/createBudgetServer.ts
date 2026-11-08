import { McpServer } from '@modelcontextprotocol/server'

import type { ModuleAccess } from '~types'

import budgetModule from '~modules/budget/budgetModule'
import BUDGET_TOOLS from '~modules/budget/budgetTools'
import createModuleToolRegistrar from '~modules/createModuleToolRegistrar'
import toModuleInstructions from '~modules/toModuleInstructions'

/*
  The Budget module's MCP server, built for one access, whose caller every tool acts as, in
  the organization its call acts in
*/
function createBudgetServer(access: ModuleAccess) {
  const server = new McpServer(
    { name: 'strategydance-budget', title: budgetModule.title, version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: toModuleInstructions('budget', access) },
  )
  const registerTool = createModuleToolRegistrar(server, access, 'budget')

  for (const register of BUDGET_TOOLS) register(registerTool)

  return server
}

export default createBudgetServer
