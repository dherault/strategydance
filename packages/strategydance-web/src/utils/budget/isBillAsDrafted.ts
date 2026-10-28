import type { Bill, BillDraft } from '~types'

/*
  Whether a bill, as the server now holds it, says what a save of the dialog wrote, field for field,
  its receipt included: the mark of a save that went through though its answer was lost, rather
  than of somebody else's save meanwhile
*/
function isBillAsDrafted(bill: Bill, draft: BillDraft) {
  return (
    bill.name === draft.name
    && bill.description === draft.description
    && bill.company === draft.company
    && bill.amountMinor === draft.amountMinor
    && bill.currency === draft.currency
    && bill.paidOn === draft.paidOn
    && bill.recurrence === draft.recurrence
    && bill.endsOn === draft.endsOn
    && bill.paidById === draft.paidById
    && (bill.receipt?.id ?? null) === draft.receiptId
  )
}

export default isBillAsDrafted
