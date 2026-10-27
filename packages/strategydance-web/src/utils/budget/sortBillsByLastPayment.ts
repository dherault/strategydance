import { type BudgetBill, getLastBillPayment } from 'strategydance-core'

/*
  The bills as the Bills tab lists them: by their last payment on or before today, newest first,
  a bill whose first payment is still ahead on top, then by name and by id, so two bills paid the
  same day keep their places
*/
function sortBillsByLastPayment<T extends BudgetBill>(bills: readonly T[], today: string) {
  return bills
    .map(bill => ({ bill, lastPayment: getLastBillPayment(bill, today) }))
    .sort(
      (a, b) =>
        b.lastPayment.localeCompare(a.lastPayment)
        || a.bill.name.localeCompare(b.bill.name)
        || a.bill.id.localeCompare(b.bill.id),
    )
    .map(({ bill }) => bill)
}

export default sortBillsByLastPayment
