import { describe, expect, it } from 'bun:test'

import {
  ORGANIZATION_SLUG_BASE_MAX_LENGTH,
  ORGANIZATION_SLUG_PATTERN,
  ORGANIZATION_SLUG_SUFFIX_LENGTH,
  SUPPORTED_LOCALES,
} from 'strategydance-core'

const schema = await Bun.file(new URL('./schema/schema.gql', import.meta.url)).text()
const webMutations = await Bun.file(new URL('./strategydance-web-connector/mutations.gql', import.meta.url)).text()

/*
  `Locale` is declared twice, once here and once in strategydance-core, because neither side can
  read the other: Data Connect's schema is GraphQL SDL that a Go binary parses, and core is the
  TypeScript the catalogues and the language picker are built from.

  Two declarations of one set is a drift waiting to happen, so this is the thing that fails when
  a locale is added to one and not the other. It reads the SDL as text rather than parsing it,
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
