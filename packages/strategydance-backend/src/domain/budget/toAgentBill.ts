import type { BillRecurrence, Currency } from 'strategydance-core'

import type { AgentBill } from '~types'

import toCanonicalUuid from '~utils/toCanonicalUuid'

// A bill as the operations read it, whichever read
type AgentBillRow = {
  id: string
  name: string
  description: string
  company: string
  amountMinor: string
  currency: Currency
  paidOn: string
  recurrence?: BillRecurrence | null
  endsOn?: string | null
  paidById?: string | null
  paidBy?: { displayName?: string | null } | null
  receiptId?: string | null
  updatedAt: string
}

// A bill row as the Budget module computes with it: its amount a number, which `MAX_MONEY_MINOR`
// keeps exact, and its ids dashless, as Data Connect writes them
function toAgentBill(row: AgentBillRow): AgentBill {
  return {
    id: toCanonicalUuid(row.id),
    name: row.name,
    description: row.description,
    company: row.company,
    amountMinor: Number(row.amountMinor),
    currency: row.currency,
    paidOn: row.paidOn,
    recurrence: row.recurrence ?? null,
    endsOn: row.endsOn ?? null,
    paidById: row.paidById ?? null,
    paidByName: row.paidBy?.displayName ?? null,
    receiptId: row.receiptId ? toCanonicalUuid(row.receiptId) : null,
    updatedAt: row.updatedAt,
  }
}

export default toAgentBill
