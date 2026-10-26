import { type BillSchedule, getLastBillPayment } from 'strategydance-core'

/*
  The years whose exchange rates the Budget page reads: this year and last year, which its stats,
  chart and panels count, and the year of each bill's last payment, at whose rate the Bills tab
  converts the bill. A payment after the rates stored converts at the latest, so next year, which
  December's "next month" reaches into, needs none of its own
*/
function listExchangeRateYears(bills: readonly BillSchedule[], today: string) {
  const year = Number(today.slice(0, 4))
  const years = new Set([year - 1, year])

  for (const bill of bills) years.add(Number(getLastBillPayment(bill, today).slice(0, 4)))

  return [...years].sort((a, b) => a - b)
}

export default listExchangeRateYears
