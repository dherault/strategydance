import { describe, expect, it } from 'bun:test'

import {
  BILL_RECEIPT_ATTACHABLE_DAYS,
  BILL_RECEIPT_CONTENT_TYPES,
  BILL_RECEIPT_PRUNE_DAYS,
  BILL_RECURRENCES,
  BUDGET_PERIOD_MONTHS,
  Currency,
  KnowledgeKind,
  MAX_BILL_COMPANY_LENGTH,
  MAX_BILL_DESCRIPTION_LENGTH,
  MAX_BILL_NAME_LENGTH,
  MAX_AGENT_BILL_RECEIPT_SIZE,
  MAX_BILL_RECEIPT_NAME_LENGTH,
  MAX_BILL_RECEIPT_SIZE,
  MAX_BILLS,
  MAX_DAILY_RECEIPT_READS_PER_MEMBER,
  MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION,
  MAX_MONEY_MINOR,
  ORGANIZATION_SLUG_BASE_MAX_LENGTH,
  ORGANIZATION_SLUG_PATTERN,
  ORGANIZATION_SLUG_SUFFIX_LENGTH,
  SUPPORTED_LOCALES,
} from 'strategydance-core'

const schema = await Bun.file(new URL('./schema/schema.gql', import.meta.url)).text()
const webMutations = await Bun.file(new URL('./strategydance-web-connector/mutations.gql', import.meta.url)).text()
const webQueries = await Bun.file(new URL('./strategydance-web-connector/queries.gql', import.meta.url)).text()
const backendMutations = await Bun.file(
  new URL('./strategydance-backend-connector/mutations.gql', import.meta.url),
).text()
const backendQueries = await Bun.file(new URL('./strategydance-backend-connector/queries.gql', import.meta.url)).text()

/*
  `Locale`, `Currency` and `KnowledgeKind` are declared twice, once here and once in
  strategydance-core, because neither side can read the other: Data Connect's schema is GraphQL SDL
  that a Go binary parses, and core is the TypeScript the catalogues, the language picker, the
  Budget's computations and the knowledge's kinds are built from.

  Two declarations of one set is a drift waiting to happen, so this is the thing that fails when
  a value is added to one and not the other. It reads the SDL as text rather than parsing it,
  which is enough for an enum body and adds no dependency to a package that has none
*/
function readEnumValues(name: string): string[] {
  const match = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema)

  if (!match) throw new Error(`No "${name}" enum in schema.gql`)

  return match[1]!
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

describe('schema.gql', () => {
  it('declares the same locales as strategydance-core', () => {
    expect(readEnumValues('Locale').sort()).toEqual([...SUPPORTED_LOCALES].sort())
  })

  // In order, since an enum's order is the Postgres enum's
  it('declares the same currencies as strategydance-core, in the same order', () => {
    expect(readEnumValues('Currency')).toEqual(Object.values(Currency))
  })

  // In order, as the currencies are
  it("declares the knowledge's kinds strategydance-core lists, in the same order", () => {
    expect(readEnumValues('KnowledgeKind')).toEqual(Object.values(KnowledgeKind))
  })

  it("declares the budget's periods strategydance-core counts the months of", () => {
    expect(readEnumValues('BudgetPeriod')).toEqual(Object.keys(BUDGET_PERIOD_MONTHS))
  })

  it("declares the bills' recurrences strategydance-core lists, in their order", () => {
    expect(readEnumValues('BillRecurrence')).toEqual([...BILL_RECURRENCES])
  })
})

/*
  An organization's slug is drawn by strategydance-core and checked by `CreateOrganization`, which
  cannot import the pattern: this fails when the check stops holding a slug to the same one
*/
describe('CreateOrganization', () => {
  it('checks a slug against the pattern and length strategydance-core draws it to', () => {
    const match = /size\(vars\.slug\) <= (\d+) && vars\.slug\.matches\('([^']*)'\)/.exec(webMutations)

    if (!match) throw new Error('No slug check in CreateOrganization')

    expect(Number(match[1])).toBe(ORGANIZATION_SLUG_BASE_MAX_LENGTH + 1 + ORGANIZATION_SLUG_SUFFIX_LENGTH)
    expect(match[2]).toBe(ORGANIZATION_SLUG_PATTERN.source)
  })
})

// One operation's text, from its name to the brace that closes it at the start of a line
function readOperation(source: string, name: string) {
  const match = new RegExp(`\\n(?:query|mutation) ${name}\\b[\\s\\S]*?\\n}\\n`).exec(source)

  if (!match) throw new Error(`No "${name}" operation`)

  return match[0]
}

// The whole numbers a pattern captures in an operation, each once
function readNumbers(operation: string, pattern: RegExp) {
  return [...new Set([...operation.matchAll(pattern)].map(match => Number(match[1])))]
}

/*
  A bill's limits are strategydance-core's, which the page and the module check against, and the
  operations write out again, since they cannot import them: this fails when the two stop agreeing
*/
describe('the bills', () => {
  for (const [name, source] of [
    ['CreateBill', webMutations],
    ['UpdateBill', webMutations],
    ['CreateBillForAgent', backendMutations],
    ['UpdateBillForAgent', backendMutations],
  ] as const) {
    it(`${name} holds a bill to the lengths and amount strategydance-core does`, () => {
      const operation = readOperation(source, name)

      expect(readNumbers(operation, /size\(vars\.name\) <= (\d+)/g)).toEqual([MAX_BILL_NAME_LENGTH])
      expect(readNumbers(operation, /size\(vars\.company\) <= (\d+)/g)).toEqual([MAX_BILL_COMPANY_LENGTH])
      expect(readNumbers(operation, /size\(vars\.description\) <= (\d+)/g)).toEqual([MAX_BILL_DESCRIPTION_LENGTH])
      expect(readNumbers(operation, /vars\.amountMinor <= (\d+)/g)).toEqual([MAX_MONEY_MINOR])
    })
  }

  for (const [name, source] of [
    ['CreateBill', webMutations],
    ['RestoreBill', webMutations],
    ['CreateBillForAgent', backendMutations],
    ['RestoreBillForAgent', backendMutations],
  ] as const) {
    it(`${name} counts the live bills up to strategydance-core's cap`, () => {
      const operation = readOperation(source, name)

      expect(readNumbers(operation, /size\(this\) < (\d+)/g)).toEqual([MAX_BILLS])
      expect(readNumbers(operation, /limit: (\d+)/g)).toContain(MAX_BILLS)
    })
  }

  for (const [name, source] of [
    ['GetExchangeRates', webQueries],
    ['GetExchangeRatesForAgent', backendQueries],
  ] as const) {
    it(`${name} reads every year of every currency the ECB has published since 1999, and decades more`, () => {
      const [limit] = readNumbers(readOperation(source, name), /limit: (\d+)/g)
      const currencies = readEnumValues('Currency').filter(currency => currency !== 'EUR')

      expect(limit).toBeGreaterThanOrEqual(currencies.length * (new Date().getUTCFullYear() + 30 - 1999 + 1))
    })
  }

  it('GetBills reads as many bills as an organization keeps', () => {
    expect(readNumbers(readOperation(webQueries, 'GetBills'), /limit: (\d+)/g)).toEqual([MAX_BILLS])
  })

  it('GetBudgetForAgent reads as many bills as an organization keeps', () => {
    expect(readNumbers(readOperation(backendQueries, 'GetBudgetForAgent'), /limit: (\d+)/g)).toContain(MAX_BILLS)
  })

  it('SetBudget holds an amount to the most strategydance-core takes', () => {
    expect(readNumbers(readOperation(webMutations, 'SetBudget'), /vars\.amountMinor <= (\d+)/g)).toEqual([
      MAX_MONEY_MINOR,
    ])
  })

  for (const [name, source] of [
    ['CreateBill', webMutations],
    ['UpdateBill', webMutations],
    ['CreateBillForAgent', backendMutations],
    ['UpdateBillForAgent', backendMutations],
  ] as const) {
    it(`${name} takes a receipt nothing holds within strategydance-core's days of its upload`, () => {
      expect(readNumbers(readOperation(source, name), /sub: \{ days: (\d+) \}/g)).toEqual([
        BILL_RECEIPT_ATTACHABLE_DAYS,
      ])
    })
  }

  for (const name of ['GetPrunableBillReceipts', 'DeleteBillReceipts']) {
    it(`${name} prunes a receipt nothing holds a day after a save could last take it`, () => {
      const operation = readOperation(name === 'DeleteBillReceipts' ? backendMutations : backendQueries, name)

      expect(readNumbers(operation, /sub: \{ days: (\d+) \}/g)).toEqual([BILL_RECEIPT_PRUNE_DAYS])
      expect(BILL_RECEIPT_PRUNE_DAYS).toBe(BILL_RECEIPT_ATTACHABLE_DAYS + 1)
    })
  }

  for (const [name, size] of [
    ['ReserveBillReceipt', MAX_BILL_RECEIPT_SIZE],
    ['ReserveBillReceiptForAgent', MAX_AGENT_BILL_RECEIPT_SIZE],
    ['ReserveAttachmentBillReceiptForAgent', MAX_BILL_RECEIPT_SIZE],
  ] as const) {
    it(`${name} takes the receipts' name, size and types strategydance-core does`, () => {
      const operation = readOperation(backendMutations, name)
      const types = /vars\.contentType in \[([^\]]*)\]/.exec(operation)?.[1]

      expect(readNumbers(operation, /size\(vars\.name\) <= (\d+)/g)).toEqual([MAX_BILL_RECEIPT_NAME_LENGTH])
      expect(readNumbers(operation, /vars\.size <= (\d+)/g)).toEqual([size])
      expect(types?.split(',').map(type => type.trim().replaceAll("'", ''))).toEqual(BILL_RECEIPT_CONTENT_TYPES)
    })
  }

  it("names the Budget module's bill writes in GetBills' refreshes", () => {
    const query = readOperation(webQueries, 'GetBills')

    for (const name of ['CreateBillForAgent', 'UpdateBillForAgent', 'DeleteBillForAgent', 'RestoreBillForAgent']) {
      expect(query).toContain(`operation: "${name}"`)
    }
  })

  it("ClaimBillReceiptRead and GetBillReceiptReads count to the reader's caps", () => {
    const caps = [MAX_DAILY_RECEIPT_READS_PER_MEMBER, MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION]
    const claim = readOperation(backendMutations, 'ClaimBillReceiptRead')

    expect(readNumbers(claim, /size\(this\) < (\d+)/g)).toEqual(caps)
    expect(readNumbers(claim, /limit: (\d+)/g)).toEqual(caps)
    expect(readNumbers(readOperation(backendQueries, 'GetBillReceiptReads'), /limit: (\d+)/g)).toEqual(caps)
  })
})
