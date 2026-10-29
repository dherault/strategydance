import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { BudgetToolContext } from '~types'

import updateBill from '~domain/budget/updateBill'

import budgetModule from '~modules/budget/budgetModule'
import {
  amountSchema,
  billIdSchema,
  billNameSchema,
  billShape,
  companySchema,
  currencySchema,
  daySchema,
  descriptionSchema,
  payerSchema,
  recurrenceSchema,
  statusSchema,
  updateReceiptSchema,
} from '~modules/budget/budgetSchemas'
import readBudgetWriteCall from '~modules/budget/readBudgetWriteCall'
import toBudgetWriteResult from '~modules/budget/toBudgetWriteResult'
import requireModuleWriteScope from '~modules/requireModuleWriteScope'

const TOOL = 'update_bill'

// The fields a call can change, at least one of which it names
const FIELDS = [
  'name',
  'description',
  'company',
  'amount',
  'currency',
  'paidOn',
  'recurrence',
  'endsOn',
  'paidBy',
  'receipt',
] as const

const inputSchema = z
  .object({
    id: billIdSchema.describe("The bill's id"),
    version: z
      .string()
      .max(200)
      .optional()
      .describe('The version read_bill gave: refused once a member saved the bill since, rather than saved over it'),
    name: billNameSchema.optional().describe('A new name, one line of at most 80 characters'),
    description: descriptionSchema.optional().describe('A new description, at most 140 characters, "" clearing it'),
    company: companySchema.optional().describe('The company paid, one line of at most 60 characters'),
    amount: amountSchema.optional().describe("What one payment costs, a decimal string in the bill's currency"),
    currency: currencySchema.optional().describe('A new currency, which the amount, given or kept, has to fit'),
    paidOn: daySchema.optional().describe('The day it is paid, or first paid when it recurs, YYYY-MM-DD'),
    recurrence: recurrenceSchema
      .nullable()
      .optional()
      .describe('How often it is paid again, null for a one-time payment'),
    endsOn: daySchema.nullable().optional().describe('The day a recurring bill stops, null while it goes on'),
    paidBy: payerSchema.optional().describe('Who pays it: "me", or "member:<id>"'),
    receipt: updateReceiptSchema
      .nullable()
      .optional()
      .describe(
        "A receipt replacing the bill's, null removing it, which keeps the one let go among its earlierReceipts",
      ),
  })
  .superRefine((args, context) => {
    if (FIELDS.every(field => args[field] === undefined)) {
      context.addIssue({ code: 'custom', message: `Name at least one of ${FIELDS.join(', ')} to change` })
    }
  })

const outputSchema = z.object({
  ...billShape,
  budgetCurrency: currencySchema,
  status: statusSchema,
})

// `update_bill`: the fields of a bill a call names, and no other
function registerUpdateBill(server: McpServer, context: BudgetToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Update a bill',
      description:
        "Changes the fields of a bill the call names, keeping the rest, as the bill's dialog saves it. A currency changed without an amount keeps the amount as written, which the new currency has to take; a recurrence set to null ends the bill's end too. When a member saved the bill meanwhile, your fields are laid over what they saved, unless you send the `version` read_bill gave, which refuses the change instead. Answers the bill and `status`, whether spending is over the budget, or would pass it, once the change counts.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      scopeChallenge: requireModuleWriteScope(budgetModule),
    },
    async (args, serverContext) => {
      const prepared = readBudgetWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toBudgetWriteResult(await updateBill(context.caller, args, prepared.call), context.toAddress)
    },
  )
}

export default registerUpdateBill
