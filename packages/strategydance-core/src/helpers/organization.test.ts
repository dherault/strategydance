import { describe, expect, it } from 'bun:test'

import { ORGANIZATION_SLUG_BASE_MAX_LENGTH } from '../constants'

import {
  createOrganizationSlug,
  isOrganizationSlug,
  isOrganizationSlugTakenError,
  slugifyOrganizationName,
} from './organization'

describe('slugifyOrganizationName', () => {
  it('joins the words of a name with dashes, in lowercase', () => {
    expect(slugifyOrganizationName('Strategy Dance')).toBe('strategy-dance')
    expect(slugifyOrganizationName('  Acme,  Inc. (Europe)  ')).toBe('acme-inc-europe')
    expect(slugifyOrganizationName('R2-D2 & C-3PO')).toBe('r2-d2-c-3po')
  })

  it('drops accents and spells the letters decomposition leaves whole', () => {
    expect(slugifyOrganizationName('Café Crème Brûlée')).toBe('cafe-creme-brulee')
    expect(slugifyOrganizationName('Straße Œuvre Æsir')).toBe('strasse-oeuvre-aesir')
    expect(slugifyOrganizationName('Ørsted Łódź Þing')).toBe('orsted-lodz-thing')
    expect(slugifyOrganizationName('İstanbul')).toBe('istanbul')
  })

  it('falls back to a word of its own when nothing of the name is left', () => {
    expect(slugifyOrganizationName('戦略ダンス')).toBe('organization')
    expect(slugifyOrganizationName('🚀✨')).toBe('organization')
    expect(slugifyOrganizationName('---')).toBe('organization')
  })

  it('keeps what it can of a name written partly in another script', () => {
    expect(slugifyOrganizationName('Tokyo 戦略 Lab')).toBe('tokyo-lab')
  })

  it('cuts a long name, and never ends on the dash a cut lands on', () => {
    const long = slugifyOrganizationName('The International Federation of Very Long Names')

    expect(long).toBe('the-international-federation-of')
    expect(long.length).toBeLessThanOrEqual(ORGANIZATION_SLUG_BASE_MAX_LENGTH)

    // 32 characters end exactly on the dash before "x"
    expect(slugifyOrganizationName(`${'a'.repeat(31)} xyz`)).toBe('a'.repeat(31))
  })
})

describe('createOrganizationSlug', () => {
  it('adds a dash and four random letters or digits to the name', () => {
    const slug = createOrganizationSlug('Strategy Dance')

    expect(slug).toMatch(/^strategy-dance-[a-z0-9]{4}$/)
    expect(isOrganizationSlug(slug)).toBe(true)
  })

  it('makes a valid slug of any name', () => {
    for (const name of ['戦略ダンス', 'A', 'x'.repeat(80), 'Café', '  --  ']) {
      expect(isOrganizationSlug(createOrganizationSlug(name))).toBe(true)
    }
  })

  it('draws a different suffix each time', () => {
    const suffixes = new Set(Array.from({ length: 50 }, () => createOrganizationSlug('Acme').slice(-4)))

    expect(suffixes.size).toBeGreaterThan(45)
  })
})

describe('isOrganizationSlug', () => {
  it('accepts a slug', () => {
    expect(isOrganizationSlug('strategy-dance-ad34')).toBe(true)
    expect(isOrganizationSlug('organization-0000')).toBe(true)
  })

  it('refuses a page of the app, an id, and anything not a slug', () => {
    for (const value of [
      'today',
      'legal',
      'account',
      '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
      'strategy-dance-ad3',
      'strategy-dance-ad345',
      'Strategy-Dance-AD34',
      '-ad34',
      'strategy--dance-ad34',
      'strategy-dance-ad34-',
      'stratégie-ad34',
      '',
    ]) {
      expect(isOrganizationSlug(value)).toBe(false)
    }
  })
})

describe('isOrganizationSlugTakenError', () => {
  it('recognises the unique index on the slug, as either SDK reports it', () => {
    expect(isOrganizationSlugTakenError(new Error('violates SQL unique constraint: organization_slug_uidx'))).toBe(true)
    expect(
      isOrganizationSlugTakenError(
        new Error(
          'DataConnect error while performing request: [{"message":"violates SQL unique constraint: organization_slug_uidx"}]',
        ),
      ),
    ).toBe(true)
  })

  it('refuses any other failure', () => {
    expect(isOrganizationSlugTakenError(new Error('A name is 1 to 80 characters'))).toBe(false)
    expect(isOrganizationSlugTakenError('organization_slug_uidx')).toBe(false)
    expect(isOrganizationSlugTakenError(null)).toBe(false)
  })
})
