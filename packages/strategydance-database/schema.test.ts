import { describe, expect, it } from 'bun:test'

import {
  BILL_RECEIPT_CONTENT_TYPES,
  BUDGET_PERIOD_MONTHS,
  Currency,
  MAX_BILL_COMPANY_LENGTH,
  MAX_BILL_DESCRIPTION_LENGTH,
  MAX_BILL_NAME_LENGTH,
  MAX_BILL_RECEIPT_NAME_LENGTH,
  MAX_BILL_RECEIPT_SIZE,
  MAX_BILLS,
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

/*
  `Locale` and `Currency` are declared twice, once here and once in strategydance-core, because
  neither side can read the other: Data Connect's schema is GraphQL SDL that a Go binary parses, and
  core is the TypeScript the catalogues, the language picker and the Budget's computations are built
  from.

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

  it("declares the budget's periods strategydance-core counts the months of", () => {
    expect(readEnumValues('BudgetPeriod')).toEqual(Object.keys(BUDGET_PERIOD_MONTHS))
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
  for (const name of ['CreateBill', 'UpdateBill']) {
    it(`${name} holds a bill to the lengths and amount strategydance-core does`, () => {
      const operation = readOperation(webMutations, name)

      expect(readNumbers(operation, /size\(vars\.name\) <= (\d+)/g)).toEqual([MAX_BILL_NAME_LENGTH])
      expect(readNumbers(operation, /size\(vars\.company\) <= (\d+)/g)).toEqual([MAX_BILL_COMPANY_LENGTH])
      expect(readNumbers(operation, /size\(vars\.description\) <= (\d+)/g)).toEqual([MAX_BILL_DESCRIPTION_LENGTH])
      expect(readNumbers(operation, /vars\.amountMinor <= (\d+)/g)).toEqual([MAX_MONEY_MINOR])
    })
  }

  for (const name of ['CreateBill', 'RestoreBill']) {
    it(`${name} counts the live bills up to strategydance-core's cap`, () => {
      const operation = readOperation(webMutations, name)

      expect(readNumbers(operation, /size\(this\) < (\d+)/g)).toEqual([MAX_BILLS])
      expect(readNumbers(operation, /limit: (\d+)/g)).toContain(MAX_BILLS)
    })
  }

  it('GetBills reads as many bills as an organization keeps', () => {
    expect(readNumbers(readOperation(webQueries, 'GetBills'), /limit: (\d+)/g)).toEqual([MAX_BILLS])
  })

  it('SetBudget holds an amount to the most strategydance-core takes', () => {
    expect(readNumbers(readOperation(webMutations, 'SetBudget'), /vars\.amountMinor <= (\d+)/g)).toEqual([
      MAX_MONEY_MINOR,
    ])
  })

  it("ReserveBillReceipt takes the receipts' name, size and types strategydance-core does", () => {
    const operation = readOperation(backendMutations, 'ReserveBillReceipt')
    const types = /vars\.contentType in \[([^\]]*)\]/.exec(operation)?.[1]

    expect(readNumbers(operation, /size\(vars\.name\) <= (\d+)/g)).toEqual([MAX_BILL_RECEIPT_NAME_LENGTH])
    expect(readNumbers(operation, /vars\.size <= (\d+)/g)).toEqual([MAX_BILL_RECEIPT_SIZE])
    expect(types?.split(',').map(type => type.trim().replaceAll("'", ''))).toEqual(BILL_RECEIPT_CONTENT_TYPES)
  })
})
