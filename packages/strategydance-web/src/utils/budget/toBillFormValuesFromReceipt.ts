import type { BillReceiptFields } from 'strategydance-core'

import formatAmountInput from '~utils/budget/formatAmountInput'
import { readAmountMinor } from '~utils/budget/readAmountInput'
import toBillFormValues, { type BillFormDefaults, type BillFormValues } from '~utils/budget/toBillFormValues'

/*
  A new bill's dialog's values once the receipt reader read its receipt, with the receipt attached:
  a new bill's, the fields it found laid over them. A receipt that named no currency it knows leaves
  the budget's, an amount that currency cannot hold is left to type, and a bill it says renews is
  made recurring on that period. With no fields, a read refused or given up on, the receipt is
  attached to an empty bill
*/
function toBillFormValuesFromReceipt(
  fields: BillReceiptFields | null,
  receiptId: string,
  defaults: BillFormDefaults,
): BillFormValues {
  const values = { ...toBillFormValues(null, defaults), receiptId }

  if (!fields) return values

  const currency = fields.currency ?? defaults.currency
  const amountMinor = readAmountMinor(fields.amount ?? '', currency)

  return {
    ...values,
    name: fields.name,
    description: fields.description,
    company: fields.company,
    amount: amountMinor === null ? '' : formatAmountInput(amountMinor, currency, defaults.locale),
    currency,
    paidOn: fields.paidOn,
    isRecurring: fields.recurrence !== null,
    recurrence: fields.recurrence ?? values.recurrence,
  }
}

export default toBillFormValuesFromReceipt
