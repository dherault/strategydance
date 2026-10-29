import { BUDGET_PERIOD_MONTHS } from '../constants'
import type { BillSchedule } from '../types'

import { addCalendarDays, addCalendarMonths, countCalendarDays, countCalendarMonths } from './calendarDay'

// How many payments a recurring bill makes at most, as the prototype counted them, so a weekly bill
// started long ago never walks forever
const MAX_BILL_PAYMENTS = 3000

// How far into the future a bill's next payment is looked for
const NEXT_BILL_PAYMENT_MONTHS = 24

// A day after any a bill pays on, which a bill that never ends stops at for an answer
const LAST_CALENDAR_DAY = '9999-12-31'

/*
  The day of a recurring bill's payment at an index, the first being 0. Each is counted from
  `paidOn`, never from the payment before, so a bill paid on January 31 pays February 28, then
  March 31, rather than drifting to the 28th for good
*/
function getBillPaymentDay(bill: BillSchedule, index: number) {
  if (bill.recurrence === null) return bill.paidOn
  if (bill.recurrence === 'WEEKLY') return addCalendarDays(bill.paidOn, 7 * index)

  return addCalendarMonths(bill.paidOn, BUDGET_PERIOD_MONTHS[bill.recurrence] * index)
}

/*
  The index of a bill's last payment on or before a day, -1 when its first is after it,
  worked out from the days or months between rather than walked to, so a bill costs the window it
  is read over and never its history. It ignores `endsOn` and the payments' bound, which its
  callers hold it to
*/
function findLastBillPaymentIndex(bill: BillSchedule, day: string) {
  if (day < bill.paidOn) return -1
  if (bill.recurrence === null) return 0
  if (bill.recurrence === 'WEEKLY') return Math.floor(countCalendarDays(bill.paidOn, day) / 7)

  // The payment in the day's own month falls on the bill's date, clamped, which can still be after
  const index = Math.floor(countCalendarMonths(bill.paidOn, day) / BUDGET_PERIOD_MONTHS[bill.recurrence])

  return getBillPaymentDay(bill, index) > day ? index - 1 : index
}

// The day a recurring bill's payments stop: its end, its 3000th payment, or the given day, the earliest
function getLastBillPaymentWithin(bill: BillSchedule, to: string) {
  const end = bill.endsOn !== null && bill.endsOn < to ? bill.endsOn : to
  const index = Math.min(findLastBillPaymentIndex(bill, end), MAX_BILL_PAYMENTS - 1)

  return index < 0 ? null : getBillPaymentDay(bill, index)
}

/*
  The days a bill is paid within `[from, to]`, both included, in order. A one-time bill pays on
  `paidOn`; a recurring one every week, month, quarter or year from it, until `endsOn` and for 3000
  payments at most
*/
export function listBillPayments(bill: BillSchedule, from: string, to: string) {
  if (bill.recurrence === null) return from <= bill.paidOn && bill.paidOn <= to ? [bill.paidOn] : []

  const last = getLastBillPaymentWithin(bill, to)

  if (last === null || last < from) return []

  const payments: string[] = []

  for (let index = Math.max(0, findLastBillPaymentIndex(bill, from)); index < MAX_BILL_PAYMENTS; index++) {
    const day = getBillPaymentDay(bill, index)

    if (day > last) break
    if (day >= from) payments.push(day)
  }

  return payments
}

/*
  A bill's last payment on or before today, which the bills sort by. Before its first, it is that
  first payment, still ahead, so the bill is due rather than paid
*/
export function getLastBillPayment(bill: BillSchedule, today: string) {
  if (bill.recurrence === null || bill.paidOn > today) return bill.paidOn

  return getLastBillPaymentWithin(bill, today) ?? bill.paidOn
}

// A bill's first payment after today, within two years, or null when it makes none
export function getNextBillPayment(bill: BillSchedule, today: string) {
  const from = addCalendarDays(today, 1)
  const to = addCalendarMonths(today, NEXT_BILL_PAYMENT_MONTHS)

  if (bill.recurrence === null) return from <= bill.paidOn && bill.paidOn <= to ? bill.paidOn : null

  const last = getLastBillPaymentWithin(bill, to)

  if (last === null || last < from) return null

  // The payment after the last one on or before today, which `last` says comes before `to`
  return getBillPaymentDay(bill, findLastBillPaymentIndex(bill, today) + 1)
}

/*
  Whether a bill recurs and still has a payment to come, however far ahead: a subscription that has
  not ended, one starting years from now included, where `getNextBillPayment` looks two years ahead
*/
export function isBillActive(bill: BillSchedule, today: string) {
  if (bill.recurrence === null) return false

  const last = getLastBillPaymentWithin(bill, bill.endsOn ?? LAST_CALENDAR_DAY)

  return last !== null && last > today
}

/*
  Whether a bill is paid at least once within `[from, to]`, both included, worked out from its last
  payment on or before `to` rather than by listing its payments, so a weekly bill of decades costs
  as much as one of a month
*/
export function hasBillPaymentWithin(bill: BillSchedule, from: string, to: string) {
  if (from > to) return false
  if (bill.recurrence === null) return from <= bill.paidOn && bill.paidOn <= to

  const last = getLastBillPaymentWithin(bill, to)

  return last !== null && last >= from
}
