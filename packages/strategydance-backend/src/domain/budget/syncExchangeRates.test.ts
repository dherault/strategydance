import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { CURRENCIES } from 'strategydance-core'

import {
  FRANKFURTER_1999,
  FRANKFURTER_2000,
  FRANKFURTER_2025,
  FRANKFURTER_2026,
} from '~domain/budget/testing/frankfurterAnswers'

type Row = { currency: string; year: number; rates: string }

// `ExchangeRateYear`, keyed as the table is, by currency and year
const rows = new Map<string, Row>()

const getExchangeRateYearKeys = mock(async (_dataConnect: unknown) => ({
  data: {
    exchangeRateYears: [...rows.values()]
      .sort((a, b) => b.year - a.year || a.currency.localeCompare(b.currency))
      .map(({ currency, year }) => ({ currency, year })),
  },
}))

const upsertExchangeRateYear = mock(async (_dataConnect: unknown, variables: Row) => {
  rows.set(`${variables.currency}:${variables.year}`, { ...variables })

  return { data: {} }
})

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => ({
  Currency: Object.fromEntries(Object.keys(CURRENCIES).map(currency => [currency, currency])),
  getExchangeRateYearKeys,
  upsertExchangeRateYear,
}))

const { default: syncExchangeRates } = await import('./syncExchangeRates')

// The fixtures' currencies, which the sync is held to, as it is to every one the Budget takes
const CURRENCIES_SYNCED = ['JPY', 'USD'] as const

function sync(options: Omit<Parameters<typeof syncExchangeRates>[0] & {}, 'currencies'>) {
  return syncExchangeRates({ ...options, currencies: CURRENCIES_SYNCED })
}

// Frankfurter as the fixtures answer it, by the range asked for, recording each request
function createFrankfurter(answers: Record<string, unknown> = {}) {
  const requests: { range: string; signal: AbortSignal | null | undefined }[] = []
  const byRange: Record<string, unknown> = {
    '1999-01-01..1999-12-31': FRANKFURTER_1999,
    '2000-01-01..': FRANKFURTER_2000,
    '2025-01-01..2025-12-31': FRANKFURTER_2025,
    '2026-01-01..': FRANKFURTER_2026,
    ...answers,
  }

  const fetch = mock(async (url: string, init: RequestInit) => {
    const { pathname, searchParams } = new URL(url)
    const range = pathname.replace('/v1/', '')

    requests.push({ range, signal: init.signal })
    // Every currency, so one the ECB stopped publishing fails the request for none
    expect(searchParams.has('symbols')).toBe(false)

    const answer = byRange[range]

    if (answer instanceof Error) throw answer
    if (answer === undefined) return Response.json({ message: 'not found' }, { status: 404 })
    if (answer instanceof Response) return answer

    return Response.json(answer)
  })

  return { fetch, requests }
}

function readRates(currency: string, year: number): Record<string, number> {
  const row = rows.get(`${currency}:${year}`)

  if (!row) throw new Error(`No ${currency} row for ${year}`)

  return JSON.parse(row.rates)
}

function storeYear(year: number, rates: Record<string, number>) {
  for (const currency of ['JPY', 'USD'])
    rows.set(`${currency}:${year}`, { currency, year, rates: JSON.stringify(rates) })
}

beforeEach(() => {
  rows.clear()
  upsertExchangeRateYear.mockClear()
})

describe('syncExchangeRates', () => {
  test('backfills from 1999, whose first day is January 4, to the year under way', async () => {
    const { fetch, requests } = createFrankfurter()

    expect(await sync({ fetch, today: '2000-01-04' })).toEqual({
      years: [1999, 2000],
      latestDay: '2000-01-04',
    })
    expect(requests.map(({ range }) => range)).toEqual(['1999-01-01..1999-12-31', '2000-01-01..'])
    expect(Object.keys(readRates('USD', 1999))[0]).toBe('1999-01-04')
    expect(readRates('JPY', 1999)['1999-12-30']).toBe(102.73)
    expect(readRates('USD', 2000)).toEqual({ '2000-01-03': 1.009, '2000-01-04': 1.0305 })
    expect([...rows.keys()].sort()).toEqual(['JPY:1999', 'JPY:2000', 'USD:1999', 'USD:2000'])
  })

  test('sends each request with a deadline', async () => {
    const { fetch, requests } = createFrankfurter()

    await sync({ fetch, today: '2000-01-04' })

    for (const { signal } of requests) expect(signal).toBeInstanceOf(AbortSignal)
  })

  test('fetches the year under way alone once it is stored', async () => {
    await sync({ fetch: createFrankfurter().fetch, today: '2000-01-04' })
    upsertExchangeRateYear.mockClear()

    const { fetch, requests } = createFrankfurter()

    expect(await sync({ fetch, today: '2000-01-04' })).toEqual({ years: [2000], latestDay: '2000-01-04' })
    expect(requests.map(({ range }) => range)).toEqual(['2000-01-01..'])
    expect(upsertExchangeRateYear.mock.calls.map(([, { year }]) => year)).toEqual([2000, 2000])
  })

  test('writes both years the day after a year turned, the year before whole', async () => {
    storeYear(2025, { '2025-01-02': 1.0321, '2025-12-30': 1.1757 })

    const { fetch, requests } = createFrankfurter()

    expect(await sync({ fetch, today: '2026-01-02' })).toEqual({
      years: [2025, 2026],
      latestDay: '2026-01-02',
    })
    expect(requests.map(({ range }) => range)).toEqual(['2025-01-01..2025-12-31', '2026-01-01..'])
    expect(readRates('USD', 2025)).toEqual({ '2025-01-02': 1.0321, '2025-12-30': 1.1757, '2025-12-31': 1.175 })
  })

  test("files the day a year's answer opens on under its own year", async () => {
    storeYear(2025, {})

    await sync({ fetch: createFrankfurter().fetch, today: '2026-01-02' })

    expect(readRates('USD', 2026)).toEqual({ '2026-01-02': 1.1721 })
    expect(readRates('USD', 2025)['2025-12-31']).toBe(1.175)
  })

  test('writes nothing for a year with no day of its own yet', async () => {
    storeYear(2025, {})

    const { fetch } = createFrankfurter({
      '2026-01-01..': { ...FRANKFURTER_2026, rates: { '2025-12-31': FRANKFURTER_2026.rates['2025-12-31'] } },
    })

    expect(await sync({ fetch, today: '2026-01-01' })).toEqual({ years: [2025], latestDay: '2025-12-31' })
    expect(rows.has('USD:2026')).toBe(false)
  })

  test('refuses an answer in another base, writing nothing', async () => {
    storeYear(2026, {})

    const { fetch } = createFrankfurter({ '2026-01-01..': { ...FRANKFURTER_2026, base: 'USD' } })

    await expect(sync({ fetch, today: '2026-01-02' })).rejects.toThrow('Frankfurter')
    expect(upsertExchangeRateYear).not.toHaveBeenCalled()
  })

  test.each([0, -1.17, '1.17', null])('refuses an answer holding a rate of %p, writing nothing', async rate => {
    storeYear(2026, {})

    const { fetch } = createFrankfurter({
      '2026-01-01..': { ...FRANKFURTER_2026, rates: { '2026-01-02': { JPY: 183.94, USD: rate } } },
    })

    await expect(sync({ fetch, today: '2026-01-02' })).rejects.toThrow('Frankfurter')
    expect(upsertExchangeRateYear).not.toHaveBeenCalled()
  })

  test('fails on a timeout, writing nothing', async () => {
    storeYear(2026, {})

    const { fetch } = createFrankfurter({
      '2026-01-01..': new DOMException('The operation timed out.', 'TimeoutError'),
    })

    await expect(sync({ fetch, today: '2026-01-02' })).rejects.toThrow('timed out')
    expect(upsertExchangeRateYear).not.toHaveBeenCalled()
  })

  test('fails on a status outside 2xx, naming it', async () => {
    storeYear(2026, {})

    const { fetch } = createFrankfurter({ '2026-01-01..': new Response('Unavailable', { status: 503 }) })

    await expect(sync({ fetch, today: '2026-01-02' })).rejects.toThrow('Frankfurter answered 503')
  })

  test('finishes a run that failed partway, from the latest year stored', async () => {
    const failing = createFrankfurter({ '2000-01-01..': new Response('Unavailable', { status: 503 }) })

    await expect(sync({ fetch: failing.fetch, today: '2000-01-04' })).rejects.toThrow('503')
    expect([...rows.keys()].sort()).toEqual(['JPY:1999', 'USD:1999'])

    const { fetch, requests } = createFrankfurter()

    expect(await sync({ fetch, today: '2000-01-04' })).toEqual({
      years: [1999, 2000],
      latestDay: '2000-01-04',
    })
    expect(requests.map(({ range }) => range)).toEqual(['1999-01-01..1999-12-31', '2000-01-01..'])
  })

  test.each([
    { answer: 'no day at all', today: '2000-01-04', range: '1999-01-01..1999-12-31', rates: {}, year: 1999 },
    {
      answer: 'the year before alone',
      today: '2001-01-02',
      range: '2000-01-01..2000-12-31',
      rates: { '1999-12-30': FRANKFURTER_2000.rates['1999-12-30'] },
      year: 2000,
    },
  ])(
    'stops at a past year answered with $answer, writing nothing of it or after it',
    async ({ today, range, rates, year }) => {
      const { fetch, requests } = createFrankfurter({ [range]: { ...FRANKFURTER_2000, rates } })

      await expect(sync({ fetch, today })).rejects.toThrow(`Frankfurter answered no day of ${year}`)
      expect(requests.at(-1)?.range).toBe(range)
      // The latest year stored stays before it, so the next run fetches it again
      expect([...rows.values()].every(row => row.year < year)).toBe(true)
    },
  )

  test('stops at a past year whose days end before December 20, cut short, writing nothing of it', async () => {
    const { fetch } = createFrankfurter({
      '1999-01-01..1999-12-31': { ...FRANKFURTER_1999, rates: { '1999-01-04': FRANKFURTER_1999.rates['1999-01-04'] } },
    })

    await expect(sync({ fetch, today: '2000-01-04' })).rejects.toThrow('stop at 1999-01-04, short of its end')
    expect(rows.size).toBe(0)
  })

  test('backfills from 1999 once a currency it syncs has no row at all, as one added since', async () => {
    rows.set('USD:2000', { currency: 'USD', year: 2000, rates: '{}' })

    const { fetch, requests } = createFrankfurter()

    await sync({ fetch, today: '2000-01-04' })

    expect(requests.map(({ range }) => range)).toEqual(['1999-01-01..1999-12-31', '2000-01-01..'])
    expect(readRates('JPY', 1999)['1999-01-04']).toBe(133.73)
  })

  test('fills a currency the ECB stopped publishing with empty rows, so it moves on with the others', async () => {
    storeYear(1999, {})

    // 2000's answer holds the dollar alone, as once the ECB stops publishing the yen
    const dollarOnly = Object.fromEntries(
      Object.entries(FRANKFURTER_2000.rates).map(([day, { USD }]) => [day, { USD }]),
    )
    const first = createFrankfurter({ '2000-01-01..': { ...FRANKFURTER_2000, rates: dollarOnly } })

    await sync({ fetch: first.fetch, today: '2000-01-04' })

    expect(readRates('JPY', 2000)).toEqual({})

    const { fetch, requests } = createFrankfurter({ '2000-01-01..': { ...FRANKFURTER_2000, rates: dollarOnly } })

    await sync({ fetch, today: '2000-01-04' })

    expect(requests.map(({ range }) => range)).toEqual(['2000-01-01..'])
  })

  test('keeps a row a currency has when an answer leaves the currency out', async () => {
    rows.set('USD:2025', { currency: 'USD', year: 2025, rates: '{"2025-01-02":1.0321}' })
    rows.set('JPY:2025', { currency: 'JPY', year: 2025, rates: '{"2025-01-02":162.04}' })

    const yenOnly = Object.fromEntries(Object.entries(FRANKFURTER_2025.rates).map(([day, { JPY }]) => [day, { JPY }]))

    await sync({
      fetch: createFrankfurter({ '2025-01-01..2025-12-31': { ...FRANKFURTER_2025, rates: yenOnly } }).fetch,
      today: '2026-01-02',
    })

    expect(readRates('USD', 2025)).toEqual({ '2025-01-02': 1.0321 })
    expect(readRates('JPY', 2025)['2025-12-31']).toBe(184.09)
  })

  test("ends a closed year on a day a currency asked for has a rate, not one only another's has", async () => {
    const lateOther = {
      ...FRANKFURTER_1999,
      rates: { '1999-01-04': FRANKFURTER_1999.rates['1999-01-04'], '1999-12-30': { GBP: 0.62 } },
    }
    const { fetch } = createFrankfurter({ '1999-01-01..1999-12-31': lateOther })

    await expect(sync({ fetch, today: '2000-01-04' })).rejects.toThrow('stop at 1999-01-04, short of its end')
  })

  test('syncs every currency the Budget takes but the euro by default, each with its row', async () => {
    const expected = Object.keys(CURRENCIES).filter(currency => currency !== 'EUR')

    await syncExchangeRates({ fetch: createFrankfurter().fetch, today: '2000-01-04' })

    expect(
      [...rows.values()]
        .filter(({ year }) => year === 1999)
        .map(({ currency }) => currency)
        .sort(),
    ).toEqual(expected.sort())
    expect(readRates('GBP', 1999)).toEqual({})
  })

  test('carries on a backfill a failure cut short, from the year its currency reached', async () => {
    rows.set('USD:1999', { currency: 'USD', year: 1999, rates: '{}' })
    rows.set('USD:2000', { currency: 'USD', year: 2000, rates: '{}' })

    const failing = createFrankfurter({ '2000-01-01..': new Response('Unavailable', { status: 503 }) })

    await expect(sync({ fetch: failing.fetch, today: '2000-01-04' })).rejects.toThrow('503')
    expect(rows.has('JPY:1999')).toBe(true)
    expect(rows.has('JPY:2000')).toBe(false)

    const { fetch, requests } = createFrankfurter()

    await sync({ fetch, today: '2000-01-04' })

    expect(requests.map(({ range }) => range)).toEqual(['1999-01-01..1999-12-31', '2000-01-01..'])
    expect(readRates('JPY', 2000)).toEqual({ '2000-01-03': 102.75, '2000-01-04': 105.88 })
  })
})
