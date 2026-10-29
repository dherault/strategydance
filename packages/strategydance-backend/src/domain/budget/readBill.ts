import {
  convertMoney,
  type Currency,
  formatMoneyAmount,
  listBillPayments,
  listExchangeRateYears,
} from 'strategydance-core'
import { getBillForAgent } from 'strategydance-database/backend'

import type { BudgetRefusal, ModuleBill, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import readBudgetRates from '~domain/budget/readBudgetRates'
import toAgentBill from '~domain/budget/toAgentBill'
import toMemberToday from '~domain/budget/toMemberToday'
import toModuleBill from '~domain/budget/toModuleBill'

// A bill as `read_bill` answers it, with its receipt, this year's payments, who added it and who
// saved it last
export type ReadBillAnswer = ModuleBill & {
  budgetCurrency: Currency
  receipt: { name: string; contentType: string; size: number } | null
  // What an edit replaced or removed, the 50 newest, which `update_bill` takes back by id, any of
  // the bill's however old
  earlierReceipts: { id: string; name: string; contentType: string; size: number }[]
  paymentsThisYear: { count: number; total: string; convertedTotal: string | null }
  createdBy: `member:${string}` | null
  createdByName: string | null
  createdAt: string
  updatedBy: `member:${string}` | null
  updatedByName: string | null
  updatedAt: string
  version: string
}

type ReadBillResult = { outcome: 'read'; bill: ReadBillAnswer } | BudgetRefusal

/*
  One live bill, as the bill's dialog shows it: its fields, its receipt's name, type and size, every
  payment of this calendar year, those still ahead included, their count and total in the bill's
  currency and in the budget's, who added it and when, who saved it last and when, and `version`, the
  `updatedAt` an update can be held to, so it changes nothing a member saved since
*/
async function readBill(
  caller: ModuleCaller,
  { id }: { id: string },
  toAddress: (billId: string) => Promise<string | undefined>,
): Promise<ReadBillResult> {
  const { data } = await getBillForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    id: toCanonicalUuid(id),
  })
  const [membership] = data.membership

  if (!membership) return { outcome: 'notMember' }

  const [row] = data.bills

  if (!row || row.deletedAt) return { outcome: 'notFound' }

  const today = toMemberToday(membership.user.timezone)
  const currency = data.budgets[0]?.currency ?? 'USD'
  const bill = toAgentBill({ ...row, receiptId: row.receipt?.id ?? null })
  const { rates } = await readBudgetRates([bill.currency], listExchangeRateYears([bill], today), currency)
  const year = today.slice(0, 4)
  const payments = listBillPayments(bill, `${year}-01-01`, `${year}-12-31`)
  const converted = payments.map(day => convertMoney(bill.amountMinor, bill.currency, currency, day, rates))
  const url = await toAddress(bill.id)

  return {
    outcome: 'read',
    bill: {
      ...toModuleBill(bill, { currency, today, rates }),
      budgetCurrency: currency,
      receipt: row.receipt
        ? { name: row.receipt.name, contentType: row.receipt.contentType, size: row.receipt.size }
        : null,
      earlierReceipts: row.earlierReceipts.map(receipt => ({
        id: toCanonicalUuid(receipt.id),
        name: receipt.name,
        contentType: receipt.contentType,
        size: receipt.size,
      })),
      paymentsThisYear: {
        count: payments.length,
        total: formatMoneyAmount(bill.amountMinor * payments.length, bill.currency),
        convertedTotal: converted.includes(null)
          ? null
          : formatMoneyAmount(
              converted.reduce<number>((sum, amount) => sum + (amount ?? 0), 0),
              currency,
            ),
      },
      createdBy: row.createdById ? `member:${row.createdById}` : null,
      createdByName: row.createdBy?.displayName ?? null,
      createdAt: row.createdAt,
      updatedBy: row.updatedById ? `member:${row.updatedById}` : null,
      updatedByName: row.updatedBy?.displayName ?? null,
      updatedAt: row.updatedAt,
      version: row.updatedAt,
      ...(url && { url }),
    },
  }
}

export default readBill
