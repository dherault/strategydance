import { parseMoney } from 'strategydance-core'

import type { BillDraft } from '~types'

import type { BillFormValues } from '~utils/budget/toBillFormValues'

/*
  The bill a valid form saves: its words trimmed, as the database holds them to, its amount in
  minor units of its currency, and no recurrence nor end while the switch is off. Null for a form
  its checks would refuse, which they do before it gets here
*/
function toBillDraft(values: BillFormValues): BillDraft | null {
  const amountMinor = parseMoney(values.amount.trim(), values.currency)

  if (amountMinor === null || values.paidOn === null) return null

  return {
    name: values.name.trim(),
    description: values.description.trim(),
    company: values.company.trim(),
    amountMinor,
    currency: values.currency,
    paidOn: values.paidOn,
    recurrence: values.isRecurring ? values.recurrence : null,
    endsOn: values.isRecurring ? values.endsOn : null,
    paidById: values.paidById,
    receiptId: values.receiptId,
  }
}

export default toBillDraft
