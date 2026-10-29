import { type BillSchedule, getNextBillPayment } from 'strategydance-core'

// How a bill repeats, as the Bills tab says it: still recurring, ended, or paid once
type BillRepeatState = 'recurring' | 'ended' | 'oneTime'

/*
  A recurring bill has ended once its first payment is past and it makes no payment after today.
  One whose first payment is still ahead recurs, however far ahead, which a next payment looked for
  within two years would not say
*/
function getBillRepeatState(bill: BillSchedule, today: string): BillRepeatState {
  if (bill.recurrence === null) return 'oneTime'
  if (bill.paidOn > today) return 'recurring'

  return getNextBillPayment(bill, today) === null ? 'ended' : 'recurring'
}

export { type BillRepeatState }

export default getBillRepeatState
