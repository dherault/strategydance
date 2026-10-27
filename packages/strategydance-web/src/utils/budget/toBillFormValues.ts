import { type BillRecurrence, type Currency, formatMoneyAmount } from 'strategydance-core'

import type { Bill } from '~types'

// What the bill's dialog holds while it is written: the amount as typed, and the recurrence kept
// while the switch is off, so turning it back on finds the period picked before
type BillFormValues = {
  name: string
  description: string
  company: string
  amount: string
  currency: Currency
  // Null once cleared, which the form refuses
  paidOn: string | null
  paidById: string
  isRecurring: boolean
  recurrence: BillRecurrence
  endsOn: string | null
  receiptId: string | null
}

type BillFormDefaults = {
  // The budget's, which a new bill is in until told otherwise
  currency: Currency
  // A new bill's day
  today: string
  // A new bill's payer, the reader
  viewerId: string
}

/*
  The bill's dialog's values: a bill's own, its amount written back in its currency's digits, or a
  new bill's, paid today by the reader in the budget's currency, monthly once it is made recurring
*/
function toBillFormValues(bill: Bill | null, { currency, today, viewerId }: BillFormDefaults): BillFormValues {
  if (!bill) {
    return {
      name: '',
      description: '',
      company: '',
      amount: '',
      currency,
      paidOn: today,
      paidById: viewerId,
      isRecurring: false,
      recurrence: 'MONTHLY',
      endsOn: null,
      receiptId: null,
    }
  }

  return {
    name: bill.name,
    description: bill.description,
    company: bill.company,
    amount: formatMoneyAmount(bill.amountMinor, bill.currency),
    currency: bill.currency,
    paidOn: bill.paidOn,
    // Always set: the SDK types a reference's column as optional
    paidById: bill.paidById ?? viewerId,
    isRecurring: bill.recurrence !== null,
    recurrence: bill.recurrence ?? 'MONTHLY',
    endsOn: bill.endsOn,
    receiptId: bill.receipt?.id ?? null,
  }
}

export { type BillFormValues }

export default toBillFormValues
