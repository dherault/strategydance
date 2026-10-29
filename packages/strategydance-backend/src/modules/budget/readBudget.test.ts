import { afterEach, beforeEach, describe, expect, it, mock, setSystemTime } from 'bun:test'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createBudgetTestBills, SEED_TODAY } = await import('./testing/createBudgetTestBills')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const book = createBudgetTestBills(fake, ORGANIZATION_ID)

beforeEach(() => setSystemTime(new Date(`${SEED_TODAY}T12:00:00Z`)))

afterEach(() => {
  fake.reset()
  setSystemTime()
})

describe('read_budget', () => {
  it("answers the seed's month, quarter and year as strategydance-core's summarizeBudgetPeriod computes them", async () => {
    const kit = await book.connect()

    book.seed()

    expect(await kit.answer('read_budget', {})).toEqual({
      budget: { amount: '2500.00', period: 'MONTHLY', currency: 'USD' },
      currency: 'USD',
      today: SEED_TODAY,
      ratesDate: SEED_TODAY,
      month: {
        from: '2026-10-01',
        to: '2026-10-31',
        spent: '2681.23',
        expected: '1334.35',
        limit: '2500.00',
        left: '-181.23',
        projectedLeft: '-1515.58',
      },
      quarter: {
        from: '2026-10-01',
        to: '2026-12-31',
        spent: '2681.23',
        expected: '6425.71',
        limit: '7500.00',
        left: '4818.77',
        projectedLeft: '-1606.94',
      },
      year: {
        from: '2026-01-01',
        to: '2026-12-31',
        spent: '24331.09',
        expected: '6425.71',
        limit: '30000.00',
        left: '5668.91',
        projectedLeft: '-756.80',
      },
      status: { level: 'over', scope: 'month', by: '181.23', limit: '2500.00', expected: '1334.35' },
      missingRates: [],
    })
  })

  it('answers a past month with nothing expected, and a future one with nothing spent', async () => {
    const kit = await book.connect()

    book.seed()

    const march = await kit.answer('read_budget', { month: '2026-03' })
    const december = await kit.answer('read_budget', { month: '2026-12' })

    expect(march.month).toMatchObject({ from: '2026-03-01', to: '2026-03-31', spent: '1022.97', expected: '0.00' })
    expect(december.month).toMatchObject({
      spent: '0.00',
      expected: '2799.06',
      left: '2500.00',
      projectedLeft: '-299.06',
    })
  })

  it("counts from the member's today in their time zone, the 1st of next month already in Auckland", async () => {
    const kit = await book.connect()

    setSystemTime(new Date('2026-10-31T12:30:00Z'))
    book.add({ name: 'Hosting', amountMinor: 5000, paidOn: '2026-10-31' })

    expect(await kit.answer('read_budget', {})).toMatchObject({
      today: '2026-10-31',
      month: { from: '2026-10-01', spent: '50.00' },
    })

    fake.setTimezone('member', 'Pacific/Auckland')

    expect(await kit.answer('read_budget', {})).toMatchObject({
      today: '2026-11-01',
      month: { from: '2026-11-01', to: '2026-11-30', spent: '0.00' },
    })

    // A time zone that is none counts in UTC
    fake.setTimezone('member', 'Not/A_Zone')

    expect((await kit.answer('read_budget', {})).today).toBe('2026-10-31')
  })

  it('answers no budget and no limits without one, counting in US dollars', async () => {
    const kit = await book.connect()

    book.add({ name: 'Hosting', amountMinor: 5000, paidOn: '2026-10-02' })

    expect(await kit.answer('read_budget', {})).toMatchObject({
      budget: null,
      currency: 'USD',
      ratesDate: null,
      month: { spent: '50.00', limit: null, left: null, projectedLeft: null },
      status: null,
    })
  })

  it('names a currency it has no rate for, leaving its payments out of the sums', async () => {
    const kit = await book.connect()

    fake.setBudget(ORGANIZATION_ID, { currency: 'EUR', amountMinor: 100000, period: 'MONTHLY' })
    fake.insertRates('USD', 2026, { '2026-10-16': 1.1 })
    book.add({ name: 'Hosting', amountMinor: 11000, paidOn: '2026-10-02' })
    book.add({ name: 'Office', company: 'WeWork', amountMinor: 50000, currency: 'GBP', paidOn: '2026-10-05' })

    expect(await kit.answer('read_budget', {})).toMatchObject({
      currency: 'EUR',
      ratesDate: '2026-10-16',
      month: { spent: '100.00', limit: '1000.00' },
      missingRates: ['GBP'],
    })
  })

  it('refuses a month that is not one', async () => {
    const kit = await book.connect()

    expect(await kit.refusal('read_budget', { month: '2026-13' })).toContain('Input validation error')
    expect(await kit.refusal('read_budget', { month: '1998-12' })).toContain('Input validation error')
  })
})
