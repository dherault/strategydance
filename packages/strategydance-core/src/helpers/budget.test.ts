import { describe, expect, it } from 'bun:test'

import type { Currency } from '../enums'
import type { BillRecurrence, BudgetBill, BudgetLimit, ExchangeRateTable } from '../types'

import { listUpcomingPayments, sumSpendingByCompany, summarizeBudget, summarizeBudgetPeriod } from './budget'
import { buildExchangeRateTable } from './exchangeRate'

function makeBill(
  id: string,
  name: string,
  company: string,
  amountMinor: number,
  currency: Currency,
  paidOn: string,
  recurrence: BillRecurrence | null = null,
  endsOn: string | null = null,
): BudgetBill {
  return { id, name, company, amountMinor, currency, paidOn, recurrence, endsOn }
}

/*
  The prototype's seed, `bgSeedBills`, dated as it dates them on October 19, 2026, its $2,500
  monthly budget, and its fixed rates, USD 1 and EUR 0.92, as the one day of a table: a euro bought
  1/0.92 dollars. The expected numbers below are what the prototype's `bgSummary` and its page
  computed for that day, in cents
*/
const SEED_TODAY = '2026-10-19'

const SEED_BILLS = [
  makeBill('b1', 'Claude Team plan', 'Anthropic', 15000, 'USD', '2025-12-03', 'MONTHLY'),
  makeBill('b2', 'Cloud hosting', 'Amazon Web Services', 31240, 'USD', '2026-02-01', 'MONTHLY'),
  makeBill('b3', 'Vercel Pro', 'Vercel', 2000, 'USD', '2025-08-12', 'MONTHLY'),
  makeBill('b4', 'Google Workspace', 'Google', 4200, 'USD', '2025-02-05', 'MONTHLY'),
  makeBill('b5', 'Figma Professional', 'Figma', 3000, 'USD', '2026-01-21', 'MONTHLY'),
  makeBill('b6', 'Design retainer', 'Léa Dubois Studio', 120000, 'EUR', '2026-04-28', 'MONTHLY'),
  makeBill('b7', 'Coworking desk', 'Morning Coworking', 34000, 'EUR', '2025-10-01', 'MONTHLY'),
  makeBill('b8', 'Accounting', 'Fiducial Expertise', 90000, 'EUR', '2026-01-15', 'QUARTERLY'),
  makeBill('b9', 'Apple Developer Program', 'Apple', 9900, 'USD', '2025-03-02', 'YEARLY'),
  makeBill('b10', 'Domain renewal', 'Namecheap', 1498, 'USD', '2024-11-08', 'YEARLY'),
  makeBill('b11', 'Liability insurance', 'Hiscox', 48000, 'EUR', '2025-12-10', 'YEARLY'),
  makeBill('b12', 'Newsletter', 'Beehiiv', 4900, 'USD', '2026-06-09', 'MONTHLY'),
  makeBill('b13', 'Launch ads', 'X', 40000, 'USD', '2026-10-06'),
  makeBill('b14', 'User interviews', 'Respondent', 36000, 'USD', '2026-10-15'),
  makeBill('b15', 'Sponsored posts', 'LinkedIn', 30000, 'USD', '2026-09-24'),
  makeBill('b16', 'Conference ticket', 'Station F', 25000, 'EUR', '2026-09-09'),
  makeBill('b17', 'Stock photos', 'Unsplash', 9600, 'USD', '2026-08-05'),
  makeBill('b18', 'MacBook Air', 'Apple', 149900, 'USD', '2026-06-21'),
  makeBill('b19', 'Contract review', 'Captain Contrat', 39000, 'EUR', '2026-04-02'),
]

const SEED_BUDGET: BudgetLimit = { amountMinor: 250000, period: 'MONTHLY' }

const SEED_RATES = buildExchangeRateTable([
  { currency: 'USD', year: 2026, rates: JSON.stringify({ [SEED_TODAY]: 1 / 0.92 }) },
])

const seed = { bills: SEED_BILLS, currency: 'USD', today: SEED_TODAY, rates: SEED_RATES } as const

const NO_RATES: ExchangeRateTable = new Map()

describe("summarizeBudget on the prototype's seed", () => {
  const summary = summarizeBudget({ ...seed, budget: SEED_BUDGET })

  it('computes the four stats as the prototype did', () => {
    expect(summary.month).toEqual({ spent: 268123, expected: 133435 })
    expect(summary.next).toBe(229230)
    expect(summary.year).toEqual({ spent: 2433109, expected: 642571 })
    expect(summary.quarter).toEqual({ spent: 268123, expected: 642571 })
    expect(summary.previous).toEqual({ monthToDate: 121471, yearToDate: 90657, lastYear: 245643 })
    expect(summary.recurringCount).toBe(9)
    expect(summary.monthlyLimit).toBe(250000)
    expect(summary.yearlyLimit).toBe(3000000)
    expect(summary.status).toEqual({ level: 'over', scope: 'month', by: 18123, limit: 250000, expected: 133435 })
    expect(summary.missingRates).toEqual([])
  })

  it('computes the twelve months as the prototype did', () => {
    expect(summary.months.map(({ spent, expected }) => [spent, expected])).toEqual([
      [158983, 0],
      [92397, 0],
      [102297, 0],
      [363049, 0],
      [222832, 0],
      [377632, 0],
      [325558, 0],
      [237332, 0],
      [284906, 0],
      [268123, 133435],
      [0, 229230],
      [0, 279906],
    ])
    expect(summary.months.map(({ isCurrent }) => isCurrent).indexOf(true)).toBe(9)
    expect(summary.months.filter(({ isCurrent }) => isCurrent)).toHaveLength(1)
  })

  it('lists the next 30 days as the prototype did', () => {
    expect(
      listUpcomingPayments({ ...seed, days: 30 }).map(({ day, bill, amountMinor }) => [day, bill.name, amountMinor]),
    ).toEqual([
      ['2026-10-21', 'Figma Professional', 3000],
      ['2026-10-28', 'Design retainer', 130435],
      ['2026-11-01', 'Cloud hosting', 31240],
      ['2026-11-01', 'Coworking desk', 36957],
      ['2026-11-03', 'Claude Team plan', 15000],
      ['2026-11-05', 'Google Workspace', 4200],
      ['2026-11-08', 'Domain renewal', 1498],
      ['2026-11-09', 'Newsletter', 4900],
      ['2026-11-12', 'Vercel Pro', 2000],
    ])
  })

  it('sums the spending by company as the prototype did', () => {
    expect(sumSpendingByCompany(seed).map(({ company, amountMinor }) => [company, amountMinor])).toEqual([
      ['Léa Dubois Studio', 782610],
      ['Fiducial Expertise', 391304],
      ['Morning Coworking', 369570],
      ['Amazon Web Services', 281160],
      ['Apple', 159800],
      ['Anthropic', 150000],
      ['Captain Contrat', 42391],
      ['Google', 42000],
      ['X', 40000],
      ['Respondent', 36000],
      ['LinkedIn', 30000],
      ['Station F', 27174],
      ['Figma', 27000],
      ['Beehiiv', 24500],
      ['Vercel', 20000],
      ['Unsplash', 9600],
    ])
  })

  it("hands the upcoming payments back with the caller's own bills", () => {
    const [first] = listUpcomingPayments({ ...seed, days: 30 })

    expect(first!.bill).toBe(SEED_BILLS[4]!)
  })
})

describe("summarizeBudget's status", () => {
  const today = '2026-10-19'
  const spent = makeBill('spent', 'Rent', 'Landlord', 100000, 'USD', '2026-10-01')
  const expected = makeBill('expected', 'Subscription', 'Vendor', 50000, 'USD', '2026-10-25')
  const bills = [spent, expected]

  it('warns when expected bills would pass the limit, and is over once spent does', () => {
    const budget: BudgetLimit = { amountMinor: 120000, period: 'MONTHLY' }

    expect(summarizeBudget({ bills, budget, currency: 'USD', today, rates: NO_RATES }).status).toEqual({
      level: 'warn',
      scope: 'month',
      by: 30000,
      limit: 120000,
      expected: 50000,
    })
    expect(
      summarizeBudget({ bills, budget: { ...budget, amountMinor: 90000 }, currency: 'USD', today, rates: NO_RATES })
        .status,
    ).toEqual({ level: 'over', scope: 'month', by: 10000, limit: 90000, expected: 50000 })
    expect(
      summarizeBudget({ bills, budget: { ...budget, amountMinor: 150000 }, currency: 'USD', today, rates: NO_RATES })
        .status,
    ).toBeNull()
  })

  it('follows a quarterly and a yearly budget to their own period', () => {
    const july = makeBill('july', 'Laptop', 'Apple', 200000, 'USD', '2026-07-10')
    const march = makeBill('march', 'Desk', 'Ikea', 300000, 'USD', '2026-03-10')
    const quarterly = summarizeBudget({
      bills: [...bills, july, march],
      budget: { amountMinor: 100000, period: 'QUARTERLY' },
      currency: 'USD',
      today,
      rates: NO_RATES,
    })
    const yearly = summarizeBudget({
      bills: [...bills, july, march],
      budget: { amountMinor: 550000, period: 'YEARLY' },
      currency: 'USD',
      today,
      rates: NO_RATES,
    })

    expect(quarterly.status).toEqual({ level: 'warn', scope: 'quarter', by: 50000, limit: 100000, expected: 50000 })
    expect(quarterly.monthlyLimit).toBe(33333)
    expect(quarterly.yearlyLimit).toBe(400000)
    expect(yearly.status).toEqual({ level: 'over', scope: 'year', by: 50000, limit: 550000, expected: 50000 })
    expect(yearly.monthlyLimit).toBe(45833)
    expect(yearly.yearlyLimit).toBe(550000)
  })

  it('has no status and no limits without a budget', () => {
    const summary = summarizeBudget({ bills, budget: null, currency: 'USD', today, rates: NO_RATES })

    expect(summary.status).toBeNull()
    expect(summary.monthlyLimit).toBeNull()
    expect(summary.yearlyLimit).toBeNull()
    expect(summary.month).toEqual({ spent: 100000, expected: 50000 })
  })
})

describe("summarizeBudget's periods", () => {
  it('compares March 31 with February 1 to 28', () => {
    const bills = [
      makeBill('a', 'Early', 'Vendor', 100, 'USD', '2026-02-01'),
      makeBill('b', 'Last', 'Vendor', 200, 'USD', '2026-02-28'),
      makeBill('c', 'March', 'Vendor', 400, 'USD', '2026-03-01'),
      makeBill('d', 'Monthly', 'Vendor', 1000, 'USD', '2026-01-31', 'MONTHLY'),
    ]
    const summary = summarizeBudget({ bills, budget: null, currency: 'USD', today: '2026-03-31', rates: NO_RATES })

    expect(summary.previous.monthToDate).toBe(100 + 200 + 1000)
    expect(summary.month).toEqual({ spent: 400 + 1000, expected: 0 })
  })

  it('compares February 29 with February 28 of last year', () => {
    const bills = [
      makeBill('a', 'Last year', 'Vendor', 100, 'USD', '2027-02-28'),
      makeBill('b', 'After', 'Vendor', 200, 'USD', '2027-03-01'),
    ]
    const summary = summarizeBudget({ bills, budget: null, currency: 'USD', today: '2028-02-29', rates: NO_RATES })

    expect(summary.previous).toEqual({ monthToDate: 0, yearToDate: 100, lastYear: 300 })
  })

  it('reaches into next year for next month in December, and into last year for last month in January', () => {
    const bill = makeBill('a', 'Hosting', 'Vendor', 1000, 'USD', '2026-06-15', 'MONTHLY')

    const december = summarizeBudget({
      bills: [bill],
      budget: null,
      currency: 'USD',
      today: '2026-12-20',
      rates: NO_RATES,
    })
    const january = summarizeBudget({
      bills: [bill],
      budget: null,
      currency: 'USD',
      today: '2027-01-20',
      rates: NO_RATES,
    })

    expect(december.next).toBe(1000)
    expect(december.recurringCount).toBe(1)
    expect(december.year).toEqual({ spent: 7000, expected: 0 })
    expect(january.previous).toEqual({ monthToDate: 1000, yearToDate: 0, lastYear: 7000 })
  })

  it('counts the recurring bills next month pays, not those that ended or pay once', () => {
    const bills = [
      makeBill('a', 'Monthly', 'Vendor', 1000, 'USD', '2026-01-05', 'MONTHLY'),
      makeBill('b', 'Ended', 'Vendor', 1000, 'USD', '2026-01-05', 'MONTHLY', '2026-10-31'),
      makeBill('c', 'Yearly', 'Vendor', 1000, 'USD', '2025-03-05', 'YEARLY'),
      makeBill('d', 'Once', 'Vendor', 1000, 'USD', '2026-11-05'),
      makeBill('e', 'Weekly', 'Vendor', 1000, 'USD', '2026-10-01', 'WEEKLY'),
    ]
    const summary = summarizeBudget({ bills, budget: null, currency: 'USD', today: '2026-10-19', rates: NO_RATES })

    expect(summary.recurringCount).toBe(2)
    expect(summary.next).toBe(1000 + 1000 + 4 * 1000)
  })
})

describe("summarizeBudget's missing rates", () => {
  it('leaves out a payment whose currency the table lacks, and names it', () => {
    const bills = [
      makeBill('a', 'Hosting', 'Vendor', 1000, 'USD', '2026-10-01'),
      makeBill('b', 'Office', 'Landlord', 50000, 'GBP', '2026-10-02'),
      makeBill('c', 'Retainer', 'Studio', 10000, 'EUR', '2026-10-03'),
    ]
    const rates = buildExchangeRateTable([
      { currency: 'USD', year: 2026, rates: JSON.stringify({ '2026-10-01': 1.25 }) },
    ])
    const summary = summarizeBudget({ bills, budget: null, currency: 'USD', today: '2026-10-19', rates })

    expect(summary.month).toEqual({ spent: 1000 + 12500, expected: 0 })
    expect(summary.missingRates).toEqual(['GBP'])
  })

  it('names the currency computed in when it is the one without a rate', () => {
    const bills = [
      makeBill('a', 'Hosting', 'Vendor', 1000, 'USD', '2026-10-01'),
      makeBill('b', 'Ramen', 'Shop', 1500, 'JPY', '2026-10-02'),
    ]
    const rates = buildExchangeRateTable([
      { currency: 'USD', year: 2026, rates: JSON.stringify({ '2026-10-01': 1.25 }) },
    ])
    const summary = summarizeBudget({ bills, budget: null, currency: 'JPY', today: '2026-10-19', rates })

    expect(summary.month).toEqual({ spent: 1500, expected: 0 })
    expect(summary.missingRates).toEqual(['JPY'])
  })

  it('lists an upcoming payment it cannot convert, its amount null, and leaves it out of the companies', () => {
    const bills = [makeBill('a', 'Office', 'Landlord', 50000, 'GBP', '2026-10-02', 'MONTHLY')]

    expect(listUpcomingPayments({ bills, currency: 'USD', today: '2026-10-19', days: 30, rates: NO_RATES })).toEqual([
      { bill: bills[0]!, day: '2026-11-02', amountMinor: null },
    ])
    expect(sumSpendingByCompany({ bills, currency: 'USD', today: '2026-10-19', rates: NO_RATES })).toEqual([])
  })
})

describe('summarizeBudgetPeriod', () => {
  it('answers a month, its quarter and its year as the summary computes them', () => {
    expect(summarizeBudgetPeriod({ ...seed, budget: SEED_BUDGET, month: '2026-10' })).toEqual({
      month: {
        from: '2026-10-01',
        to: '2026-10-31',
        spent: 268123,
        expected: 133435,
        limit: 250000,
        left: -18123,
        projectedLeft: -151558,
      },
      quarter: {
        from: '2026-10-01',
        to: '2026-12-31',
        spent: 268123,
        expected: 642571,
        limit: 750000,
        left: 481877,
        projectedLeft: -160694,
      },
      year: {
        from: '2026-01-01',
        to: '2026-12-31',
        spent: 2433109,
        expected: 642571,
        limit: 3000000,
        left: 566891,
        projectedLeft: -75680,
      },
      missingRates: [],
    })
  })

  it('answers a past month with nothing expected, and a future one with nothing spent', () => {
    const march = summarizeBudgetPeriod({ ...seed, budget: SEED_BUDGET, month: '2026-03' })
    const december = summarizeBudgetPeriod({ ...seed, budget: SEED_BUDGET, month: '2026-12' })

    expect(march.month).toMatchObject({ from: '2026-03-01', to: '2026-03-31', spent: 102297, expected: 0 })
    expect(march.quarter).toMatchObject({ from: '2026-01-01', to: '2026-03-31', spent: 158983 + 92397 + 102297 })
    expect(december.month).toMatchObject({ spent: 0, expected: 279906, left: 250000, projectedLeft: -29906 })
  })

  it('reads another year as the summary reads last year', () => {
    const lastYear = summarizeBudgetPeriod({ ...seed, budget: SEED_BUDGET, month: '2025-06' })

    expect(lastYear.year).toMatchObject({ from: '2025-01-01', to: '2025-12-31', spent: 245643, expected: 0 })
  })

  it('answers no limit without a budget, and refuses a month that is not one', () => {
    expect(summarizeBudgetPeriod({ ...seed, budget: null, month: '2026-10' }).month).toMatchObject({
      limit: null,
      left: null,
      projectedLeft: null,
    })
    expect(() => summarizeBudgetPeriod({ ...seed, budget: null, month: '2026-13' })).toThrow(RangeError)
    expect(() => summarizeBudgetPeriod({ ...seed, budget: null, month: '2026-1' })).toThrow(RangeError)
  })

  it('shares a yearly budget out into its quarters and months', () => {
    const period = summarizeBudgetPeriod({
      ...seed,
      budget: { amountMinor: 1000000, period: 'YEARLY' },
      month: '2026-10',
    })

    expect([period.month.limit, period.quarter.limit, period.year.limit]).toEqual([83333, 250000, 1000000])
  })
})

describe('sumSpendingByCompany', () => {
  it('groups a company however its name is cased or spaced, under its latest spelling', () => {
    const bills = [
      makeBill('a', 'Laptop', 'apple', 100000, 'USD', '2026-03-01'),
      makeBill('b', 'Developer Program', ' Apple Inc ', 9900, 'USD', '2026-02-01'),
      makeBill('c', 'Phone', 'Apple ', 80000, 'USD', '2026-09-01'),
      makeBill('d', 'Later', 'APPLE', 50000, 'USD', '2026-11-01'),
      makeBill('e', 'Last year', 'Figma', 3000, 'USD', '2025-12-01'),
    ]

    expect(sumSpendingByCompany({ bills, currency: 'USD', today: '2026-10-19', rates: NO_RATES })).toEqual([
      { company: 'Apple', amountMinor: 180000 },
      { company: 'Apple Inc', amountMinor: 9900 },
    ])
  })
})
