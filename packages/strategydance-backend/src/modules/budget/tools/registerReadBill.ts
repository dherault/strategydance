import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { BudgetToolContext } from '~types'

import readBill from '~domain/budget/readBill'

import { billIdSchema, billShape, currencySchema } from '~modules/budget/budgetSchemas'
import toBudgetRefusal from '~modules/budget/toBudgetRefusal'
import toToolResult from '~modules/toToolResult'

const inputSchema = z.object({ id: billIdSchema.describe("The bill's id") })

const outputSchema = z.object({
  ...billShape,
  budgetCurrency: currencySchema,
  receipt: z.object({ name: z.string(), contentType: z.string(), size: z.int() }).nullable(),
  earlierReceipts: z.array(z.object({ id: z.string(), name: z.string(), contentType: z.string(), size: z.int() })),
  paymentsThisYear: z.object({ count: z.int(), total: z.string(), convertedTotal: z.string().nullable() }),
  createdBy: z.string().nullable(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
  updatedBy: z.string().nullable(),
  updatedByName: z.string().nullable(),
  updatedAt: z.string(),
  version: z.string(),
})

// `read_bill`: one live bill, with its receipt, this year's payments, who added it and who saved it last
function registerReadBill(server: McpServer, { caller, toAddress }: BudgetToolContext) {
  server.registerTool(
    'read_bill',
    {
      title: 'Read a bill',
      description:
        "Reads one live bill: its fields, its last and next payments converted into `budgetCurrency`, its receipt's name, type and size, its earlier receipts, which an edit replaced or removed and update_bill takes back by id, every payment of this calendar year, those still ahead included, with their count and their total in the bill's currency and in the budget's, who added it and when, who saved it last and when, and `version`, which update_bill takes to change nothing a member saved since you read it.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const read = await readBill(caller, { id }, toAddress)

      if (read.outcome !== 'read') return toBudgetRefusal(read)

      return toToolResult(read.bill)
    },
  )
}

export default registerReadBill
