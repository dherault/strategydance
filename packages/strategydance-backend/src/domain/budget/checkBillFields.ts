import {
  addCalendarDays,
  BILL_DAYS_AHEAD,
  type BillRecurrence,
  type Currency,
  CURRENCIES,
  FIRST_BILL_DAY,
  parseMoney,
} from 'strategydance-core'

type BillFields = {
  amount: string
  currency: Currency
  paidOn: string
  recurrence: BillRecurrence | null
  endsOn: string | null
}

type CheckBillFieldsResult = { outcome: 'checked'; amountMinor: number } | { outcome: 'invalidField'; reason: string }

/*
  Whether a bill's amount, days and end are what its operations take, checked before anything is
  written, so the agent is told which and why rather than refused by a check it cannot read: an
  amount above 0 with no more decimals than its currency has, a first payment from 1999 to ten years
  after the member's today, a day short of the operations' bound so no time zone passes it, and an
  end only on a bill that recurs, on or after its first payment
*/
function checkBillFields(
  { amount, currency, paidOn, recurrence, endsOn }: BillFields,
  today: string,
): CheckBillFieldsResult {
  const amountMinor = parseMoney(amount, currency)

  if (amountMinor === null) {
    const { exponent } = CURRENCIES[currency]
    const example = exponent === 0 ? '"1500"' : `"312.${'4'.padEnd(exponent, '0')}"`

    return {
      outcome: 'invalidField',
      reason: `"${amount}" is not an amount in ${currency}, which takes digits with ${exponent === 0 ? 'no decimals' : `at most ${exponent} decimals after a point`}, as ${example}, and no sign, separator or symbol`,
    }
  }

  if (amountMinor <= 0) return { outcome: 'invalidField', reason: 'An amount is more than 0' }

  const lastDay = addCalendarDays(today, BILL_DAYS_AHEAD)

  if (paidOn < FIRST_BILL_DAY || paidOn > lastDay) {
    return { outcome: 'invalidField', reason: `A bill is first paid from ${FIRST_BILL_DAY} to ${lastDay}` }
  }

  if (endsOn !== null && recurrence === null) {
    return { outcome: 'invalidField', reason: 'Only a bill that recurs ends: give it a recurrence, or no endsOn' }
  }

  if (endsOn !== null && endsOn < paidOn) {
    return { outcome: 'invalidField', reason: 'A bill ends on or after its first payment, paidOn' }
  }

  return { outcome: 'checked', amountMinor }
}

export default checkBillFields
