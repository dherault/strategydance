import { parseMoney } from 'strategydance-core'

import type { BillDraft } from '~types'

import type { BillFormValues } from '~utils/budget/toBillFormValues'

// Any line break, which a paste can bring into a field of one line
const LINE_BREAKS = /[\r\n\u2028\u2029]+/g

/*
  The bill a valid form saves: its words trimmed and its name and company on one line, as the
  database holds them to, its amount in
  minor units of its currency, and no recurrence nor end while the switch is off. Null for a form
  its checks would refuse, which they do before it gets here
*/
function toBillDraft(values: BillFormValues): BillDraft | null {
  const amountMinor = parseMoney(values.amount.trim(), values.currency)

  if (amountMinor === null || values.paidOn === null) return null

  return {
    name: toOneLine(values.name),
    description: values.description.trim(),
    company: toOneLine(values.company),
    amountMinor,
    currency: values.currency,
    paidOn: values.paidOn,
    recurrence: values.isRecurring ? values.recurrence : null,
    endsOn: values.isRecurring ? values.endsOn : null,
    paidById: values.paidById,
    receiptId: values.receiptId,
  }
}

function toOneLine(text: string) {
  return text.replace(LINE_BREAKS, ' ').trim()
}

export default toBillDraft
