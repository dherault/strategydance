import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { BudgetToolContext } from '~types'

import addBill from '~domain/budget/addBill'

import budgetModule from '~modules/budget/budgetModule'
import {
  amountSchema,
  billNameSchema,
  billShape,
  companySchema,
  currencySchema,
  daySchema,
  descriptionSchema,
  payerSchema,
  receiptSchema,
  recurrenceSchema,
  statusSchema,
} from '~modules/budget/budgetSchemas'
import readBudgetWriteCall from '~modules/budget/readBudgetWriteCall'
import toBudgetWriteResult from '~modules/budget/toBudgetWriteResult'
import requireModuleWriteScope from '~modules/requireModuleWriteScope'

const TOOL = 'add_bill'

const inputSchema = z.object({
  name: billNameSchema.describe('A short label for the expense, one line of at most 80 characters'),
  description: descriptionSchema.optional().describe('One short line on what it is for, at most 140 characters'),
  company: companySchema.describe('The company paid, the seller, one line of at most 60 characters'),
  amount: amountSchema.describe('What one payment costs, a decimal string in `currency`, as "312.40"'),
  currency: currencySchema.describe("The bill's currency, as the receipt names it"),
  paidOn: daySchema
    .optional()
    .describe("The day it is paid, or first paid when it recurs, YYYY-MM-DD, the member's today by default"),
  recurrence: recurrenceSchema.optional().describe('How often it is paid again, left out for a one-time payment'),
  endsOn: daySchema
    .optional()
    .describe('The day a recurring bill stops, on or after paidOn, left out while it goes on'),
  paidBy: payerSchema.optional().describe('Who pays it: "me", the default, or "member:<id>"'),
  receipt: receiptSchema.optional().describe('The receipt or invoice, kept with the bill'),
})

const outputSchema = z.object({
  ...billShape,
  budgetCurrency: currencySchema,
  status: statusSchema,
})

// `add_bill`: a bill, as the Budget page's New bill adds one, with its receipt
function registerAddBill(server: McpServer, context: BudgetToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Add a bill',
      description:
        "Adds a bill to the organization's budget, as the Budget page's New bill does: what the company paid, or pays every week, month, quarter or year, with its receipt. To add one from a receipt or an invoice, read it yourself first, then send the fields you read and the receipt with them, a PDF or a photo in base64 or its text, which the bill keeps. Answers the bill, its payments converted into the budget's currency, and `status`: whether spending is over the budget, or would pass it, once the bill counts.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      scopeChallenge: requireModuleWriteScope(budgetModule),
    },
    async (args, serverContext) => {
      const prepared = readBudgetWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toBudgetWriteResult(await addBill(context.caller, args, prepared.call), context.toAddress)
    },
  )
}

export default registerAddBill
