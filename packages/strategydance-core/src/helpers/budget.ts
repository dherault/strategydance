import { BUDGET_PERIOD_MONTHS } from '../constants'
import type { Currency } from '../enums'
import type {
  BudgetBill,
  BudgetLimit,
  BudgetPeriod,
  BudgetPeriodSummary,
  BudgetPeriodsSummary,
  BudgetScope,
  BudgetSpending,
  BudgetStatus,
  BudgetSummary,
  CompanySpending,
  ExchangeRateTable,
  UpcomingBillPayment,
} from '../types'

import { listBillPayments } from './bill'
import {
  addCalendarDays,
  addCalendarMonths,
  compareDays,
  endOfMonth,
  startOfMonth,
  startOfQuarter,
} from './calendarDay'
import { convertMoney, findExchangeRate } from './exchangeRate'

/*
  What the Budget page and the Budget module compute from the bills, the budget and the rates, so
  both answer the same numbers. Every amount is in minor units of the currency computed in: the
  budget's, or US dollars while there is none. `today` is the reader's, never the clock's: the page
  passes the browser's local date, the module the member's
*/
type BudgetComputation<T extends BudgetBill> = {
  bills: readonly T[]
  budget: BudgetLimit | null
  currency: Currency
  today: string
  rates: ExchangeRateTable
}

const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/

const BUDGET_SCOPES = {
  MONTHLY: 'month',
  QUARTERLY: 'quarter',
  YEARLY: 'year',
} as const satisfies Record<BudgetPeriod, BudgetScope>

/*
  Every payment of the bills within `[from, to]`, each converted at its own day's rate. Each bill's
  payments are listed once over the whole window and bucketed after, never walked once per month
*/
function listConvertedBillPayments<T extends BudgetBill>(
  bills: readonly T[],
  currency: Currency,
  rates: ExchangeRateTable,
  from: string,
  to: string,
) {
  const payments: UpcomingBillPayment<T>[] = []

  for (const bill of bills) {
    for (const day of listBillPayments(bill, from, to)) {
      payments.push({ bill, day, amountMinor: convertMoney(bill.amountMinor, bill.currency, currency, day, rates) })
    }
  }

  return payments
}

// The currency a payment that could not convert lacks a rate for: its own, or the one computed in
function findMissingRate(rates: ExchangeRateTable, from: Currency, to: Currency, day: string) {
  return findExchangeRate(rates, from, day) === null ? from : to
}

/*
  The budget's share of a stretch of months. The budget's own period gets its amount exactly, and
  so does the year, which every period divides, so only a monthly share of a quarterly or yearly
  budget, or a quarterly share of a yearly one, rounds
*/
function getBudgetLimit(budget: BudgetLimit | null, months: number) {
  if (!budget) return null

  return Math.round((budget.amountMinor * months) / BUDGET_PERIOD_MONTHS[budget.period])
}

// Over once spent passes the limit of the budget's own period, warned once expected would take it past
function getBudgetStatus(
  budget: BudgetLimit | null,
  spendings: Record<BudgetScope, BudgetSpending>,
): BudgetStatus | null {
  if (!budget) return null

  const scope = BUDGET_SCOPES[budget.period]
  const { spent, expected } = spendings[scope]
  const limit = budget.amountMinor

  if (spent > limit) return { level: 'over', scope, by: spent - limit, limit, expected }
  if (spent + expected > limit) return { level: 'warn', scope, by: spent + expected - limit, limit, expected }

  return null
}

function addSpending(spending: BudgetSpending, amountMinor: number, isSpent: boolean) {
  if (isSpent) spending.spent += amountMinor
  else spending.expected += amountMinor
}

function isWithin(day: string, from: string, to: string) {
  return from <= day && day <= to
}

function getYearBounds(day: string) {
  const year = day.slice(0, 4)

  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

function getQuarterBounds(day: string) {
  const from = startOfQuarter(day)

  return { from, to: endOfMonth(addCalendarMonths(from, 2)) }
}

/*
  The Budget page's numbers, the prototype's `bgSummary` in minor units: a payment counts as spent
  on or before today, and expected after it. A payment whose currency has no rate yet is left out
  and its currency named in `missingRates`, rather than converted at a wrong rate
*/
export function summarizeBudget<T extends BudgetBill>({
  bills,
  budget,
  currency,
  today,
  rates,
}: BudgetComputation<T>): BudgetSummary {
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const quarter = getQuarterBounds(today)
  const year = getYearBounds(today)
  const nextStart = addCalendarMonths(monthStart, 1)
  const nextEnd = endOfMonth(nextStart)
  const lastYear = getYearBounds(addCalendarMonths(today, -12))
  const lastMonthStart = addCalendarMonths(monthStart, -1)

  // The same days last month and last year, clamped, so March 31 compares with February 28
  const lastMonthToDate = addCalendarMonths(today, -1)
  const lastYearToDate = addCalendarMonths(today, -12)
  const currentMonthIndex = Number(today.slice(5, 7)) - 1

  const summary: BudgetSummary = {
    month: { spent: 0, expected: 0 },
    quarter: { spent: 0, expected: 0 },
    year: { spent: 0, expected: 0 },
    next: 0,
    months: Array.from({ length: 12 }, (_, index) => ({
      spent: 0,
      expected: 0,
      isCurrent: index === currentMonthIndex,
    })),
    recurringCount: 0,
    monthlyLimit: getBudgetLimit(budget, 1),
    yearlyLimit: getBudgetLimit(budget, 12),
    status: null,
    previous: { monthToDate: 0, yearToDate: 0, lastYear: 0 },
    missingRates: [],
  }
  const recurringNextMonth = new Set<T>()
  const missingRates = new Set<Currency>()

  // In December, next month is January of next year
  const windowEnd = nextEnd > year.to ? nextEnd : year.to

  for (const { bill, day, amountMinor } of listConvertedBillPayments(
    bills,
    currency,
    rates,
    lastYear.from,
    windowEnd,
  )) {
    const isNextMonth = isWithin(day, nextStart, nextEnd)

    if (isNextMonth && bill.recurrence !== null) recurringNextMonth.add(bill)

    if (amountMinor === null) {
      missingRates.add(findMissingRate(rates, bill.currency, currency, day))

      continue
    }

    const isSpent = day <= today

    if (isWithin(day, year.from, year.to)) {
      addSpending(summary.year, amountMinor, isSpent)
      addSpending(summary.months[Number(day.slice(5, 7)) - 1]!, amountMinor, isSpent)

      if (isWithin(day, quarter.from, quarter.to)) addSpending(summary.quarter, amountMinor, isSpent)
      if (isWithin(day, monthStart, monthEnd)) addSpending(summary.month, amountMinor, isSpent)
    }

    if (isNextMonth) summary.next += amountMinor
    if (isWithin(day, lastYear.from, lastYear.to)) summary.previous.lastYear += amountMinor
    if (isWithin(day, lastYear.from, lastYearToDate)) summary.previous.yearToDate += amountMinor
    if (isWithin(day, lastMonthStart, lastMonthToDate)) summary.previous.monthToDate += amountMinor
  }

  summary.recurringCount = recurringNextMonth.size
  summary.status = getBudgetStatus(budget, summary)
  summary.missingRates = [...missingRates].sort()

  return summary
}

/*
  A month, `YYYY-MM`, its quarter and its year against the budget, as the Budget module's
  `read_budget` answers them: a past month has nothing expected, and a future one nothing spent
*/
export function summarizeBudgetPeriod<T extends BudgetBill>({
  bills,
  budget,
  currency,
  today,
  rates,
  month,
}: BudgetComputation<T> & { month: string }): BudgetPeriodsSummary {
  if (!MONTH_PATTERN.test(month)) throw new RangeError(`${month} is not a YYYY-MM month`)

  const monthStart = `${month}-01`
  const year = getYearBounds(monthStart)
  const periods = {
    month: { from: monthStart, to: endOfMonth(monthStart), months: 1 },
    quarter: { ...getQuarterBounds(monthStart), months: 3 },
    year: { ...year, months: 12 },
  }
  const spendings: Record<BudgetScope, BudgetSpending> = {
    month: { spent: 0, expected: 0 },
    quarter: { spent: 0, expected: 0 },
    year: { spent: 0, expected: 0 },
  }
  const missingRates = new Set<Currency>()

  for (const { bill, day, amountMinor } of listConvertedBillPayments(bills, currency, rates, year.from, year.to)) {
    if (amountMinor === null) {
      missingRates.add(findMissingRate(rates, bill.currency, currency, day))

      continue
    }

    for (const scope of ['month', 'quarter', 'year'] as const) {
      if (isWithin(day, periods[scope].from, periods[scope].to)) {
        addSpending(spendings[scope], amountMinor, day <= today)
      }
    }
  }

  const summarize = (scope: BudgetScope): BudgetPeriodSummary => {
    const { from, to, months } = periods[scope]
    const { spent, expected } = spendings[scope]
    const limit = getBudgetLimit(budget, months)

    return {
      from,
      to,
      spent,
      expected,
      limit,
      left: limit === null ? null : limit - spent,
      projectedLeft: limit === null ? null : limit - spent - expected,
    }
  }

  return {
    month: summarize('month'),
    quarter: summarize('quarter'),
    year: summarize('year'),
    missingRates: [...missingRates].sort(),
  }
}

/*
  Each payment from tomorrow to `days` from today, with its bill and its amount converted, by day,
  then by the bill's name. One whose currency has no rate is still listed, its amount null, since a
  payment coming is worth knowing of before its rate is
*/
export function listUpcomingPayments<T extends BudgetBill>({
  bills,
  currency,
  today,
  days,
  rates,
}: Omit<BudgetComputation<T>, 'budget'> & { days: number }) {
  return listConvertedBillPayments(
    bills,
    currency,
    rates,
    addCalendarDays(today, 1),
    addCalendarDays(today, days),
  ).sort(
    (a, b) => compareDays(a.day, b.day) || a.bill.name.localeCompare(b.bill.name) || a.bill.id.localeCompare(b.bill.id),
  )
}

/*
  What each company was paid this year until today, largest first. Companies are told apart by
  their name trimmed and lowercased, so "Apple" and "apple " are one, shown as its latest payment's
  bill spells it. A payment whose currency has no rate is left out, as the summary's year leaves it
*/
export function sumSpendingByCompany<T extends BudgetBill>({
  bills,
  currency,
  today,
  rates,
}: Omit<BudgetComputation<T>, 'budget'>): CompanySpending[] {
  const companies = new Map<string, CompanySpending & { latestDay: string }>()

  for (const { bill, day, amountMinor } of listConvertedBillPayments(
    bills,
    currency,
    rates,
    getYearBounds(today).from,
    today,
  )) {
    if (amountMinor === null) continue

    const key = bill.company.trim().toLowerCase()
    const company = companies.get(key)

    if (!company) companies.set(key, { company: bill.company.trim(), amountMinor, latestDay: day })
    else {
      company.amountMinor += amountMinor

      if (day > company.latestDay) {
        company.company = bill.company.trim()
        company.latestDay = day
      }
    }
  }

  return [...companies.values()]
    .map(({ company, amountMinor }) => ({ company, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor || a.company.localeCompare(b.company))
}
