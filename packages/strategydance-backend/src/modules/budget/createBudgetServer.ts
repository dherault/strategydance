import { McpServer } from '@modelcontextprotocol/server'

import type { ModuleCaller } from '~types'

import { MODULE_IDEMPOTENCY_KEY_META } from '~constants'

import budgetModule from '~modules/budget/budgetModule'
import BUDGET_TOOLS from '~modules/budget/budgetTools'
import createModuleAddresses from '~modules/createModuleAddresses'

// What the server tells an agent before it calls anything: what Strategy Dance is, what the budget
// and the bills hold and how amounts are written, and how to write to them safely
const INSTRUCTIONS = `Strategy Dance accompanies a company's team as it builds, sells and runs the company. This server is the organization's budget: what the company means to spend, a limit a month, a quarter or a year that an administrator sets on the Budget page, and its bills, what it spends, each paid once or every week, month, quarter or year, with its receipt. You act as one member of the organization.

A bill has a one-line name, a short description, the company paid, an amount in its own currency, the day it is first paid (paidOn), how it recurs, the day it ends if it does (endsOn), the member who pays it, and its receipt. Each payment converts into the budget's currency at the European Central Bank's rate of its own day, the latest rate for a payment still ahead, as the Budget page converts it, and today is the member's today.

Amounts are decimal strings in their currency, with at most its decimals and no sign, separator or symbol: "312.40" in USD, "1500" in JPY. A member is named as member:<id>, or "me" for the member you act as. A receipt is a PDF or a photo in base64, 700 KiB at most once decoded, or the receipt's text: read it yourself, then add the bill with the fields you read and the receipt with them.

The bills are the team's: any member adds, changes and deletes any bill, and members save bills while you do. The budget itself is an administrator's alone, which no agent changes.

Every write tool takes an idempotency key in the call's _meta, under "${MODULE_IDEMPOTENCY_KEY_META}": send a new one with each write, and the same one when you send the same write again after losing its answer. A write sent again without a key can be applied twice.`

// The Budget module's MCP server, built for one caller, whom every tool acts as
function createBudgetServer(caller: ModuleCaller) {
  const server = new McpServer(
    { name: 'strategydance-budget', title: budgetModule.title, version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  )
  const context = { caller, toAddress: createModuleAddresses(caller, 'budget') }

  for (const register of BUDGET_TOOLS) register(server, context)

  return server
}

export default createBudgetServer
