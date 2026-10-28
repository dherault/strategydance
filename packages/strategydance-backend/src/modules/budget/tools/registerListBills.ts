import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { BudgetToolContext } from '~types'

import { BILL_LIST_PAGE_SIZE } from '~constants'

import listBills from '~domain/budget/listBills'

import { billShape, currencySchema, daySchema, payerSchema, querySchema } from '~modules/budget/budgetSchemas'
import toBudgetRefusal from '~modules/budget/toBudgetRefusal'
import toToolResult from '~modules/toToolResult'

const inputSchema = z
  .object({
    query: querySchema
      .optional()
      .describe("Words each of which a bill's name, description or company holds, whatever their case"),
    paidFrom: daySchema.optional().describe('Bills with a payment on or after this day, YYYY-MM-DD'),
    paidTo: daySchema.optional().describe('Bills with a payment on or before this day, YYYY-MM-DD'),
    paidBy: payerSchema.optional().describe('Bills one member pays: "me", or "member:<id>"'),
    recurring: z.boolean().optional().describe('Subscriptions alone when true, one-time bills alone when false'),
    active: z
      .boolean()
      .optional()
      .describe(
        'Subscriptions with a payment still to come when true; when false, ended subscriptions and one-time bills',
      ),
    limit: z
      .int()
      .min(1)
      .max(BILL_LIST_PAGE_SIZE)
      .optional()
      .describe(`At most this many bills, ${BILL_LIST_PAGE_SIZE} by default`),
    cursor: z.string().max(1000).optional().describe('The nextCursor the previous page gave, to read the next one'),
  })
  .refine(
    ({ paidFrom, paidTo }) => paidFrom === undefined || paidTo === undefined || paidFrom <= paidTo,
    'paidFrom comes on or before paidTo',
  )

const outputSchema = z.object({
  bills: z.array(z.object(billShape)),
  total: z.int(),
  budgetCurrency: currencySchema,
  nextCursor: z.string().optional(),
})

// `list_bills`: a page of the live bills, filtered, the latest paid first
function registerListBills(server: McpServer, { caller, toAddress }: BudgetToolContext) {
  server.registerTool(
    'list_bills',
    {
      title: 'List bills',
      description: `Lists the organization's live bills, the latest paid first, up to ${BILL_LIST_PAGE_SIZE} a page with their \`total\` and a \`nextCursor\` while more remain. Each bill has its fields, its amount as typed in its own currency, its payer as member:<id>, whether it has a receipt, its last payment, on or before today, else its first, still ahead, and its next payment within two years, each converted into \`budgetCurrency\`, the budget's, and \`isActive\` for a subscription with a payment still to come. Filters combine: \`query\` matches every word in a bill's name, description or company; \`paidFrom\` and \`paidTo\` keep the bills with a payment between them; \`recurring\` and \`active\` find subscriptions, the active ones being those a member could still cancel.`,
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async filters => {
      const listed = await listBills(caller, filters, toAddress)

      if (listed.outcome !== 'listed') return toBudgetRefusal(listed)

      return toToolResult(listed.page)
    },
  )
}

export default registerListBills
