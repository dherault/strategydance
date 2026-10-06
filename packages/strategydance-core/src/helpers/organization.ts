import {
  ORGANIZATION_SLUG_BASE_MAX_LENGTH,
  ORGANIZATION_SLUG_PATTERN,
  ORGANIZATION_SLUG_SUFFIX_LENGTH,
} from '../constants'

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

// The base a name that keeps no letter or digit takes, as a name written in Japanese or in emoji
const FALLBACK_SLUG_BASE = 'organization'

// Latin letters that decomposition leaves whole, written as they are usually spelled in an address
const LETTER_SPELLINGS: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  ø: 'o',
  œ: 'oe',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
}

/*
  The words of an organization's name as a slug's base: accents dropped, lowercase, and every run
  of anything but a letter or a digit one dash, at most `ORGANIZATION_SLUG_BASE_MAX_LENGTH` long
*/
export function slugifyOrganizationName(name: string) {
  const base = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[ßæøœłđðþı]/g, letter => LETTER_SPELLINGS[letter] ?? letter)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ORGANIZATION_SLUG_BASE_MAX_LENGTH)
    .replace(/-+$/, '')

  return base || FALLBACK_SLUG_BASE
}

/*
  Uniform over the alphabet: a byte at or past the largest multiple of its length is drawn again,
  since keeping it would favour the first few characters
*/
function createSlugSuffix() {
  const limit = 256 - (256 % SLUG_ALPHABET.length)
  let suffix = ''

  while (suffix.length < ORGANIZATION_SLUG_SUFFIX_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(ORGANIZATION_SLUG_SUFFIX_LENGTH))) {
      if (byte < limit && suffix.length < ORGANIZATION_SLUG_SUFFIX_LENGTH)
        suffix += SLUG_ALPHABET[byte % SLUG_ALPHABET.length]
    }
  }

  return suffix
}

/*
  A new slug for an organization of that name. Its suffix is random, so two organizations of one
  name get two slugs, and one that draws a slug already taken draws again: the database's unique
  index is what says so
*/
export function createOrganizationSlug(name: string) {
  return `${slugifyOrganizationName(name)}-${createSlugSuffix()}`
}

// The longest a slug gets: the longest base, a dash and the suffix
const ORGANIZATION_SLUG_MAX_LENGTH = ORGANIZATION_SLUG_BASE_MAX_LENGTH + 1 + ORGANIZATION_SLUG_SUFFIX_LENGTH

// Whether a value is a slug as `createOrganizationSlug` draws one, and `CreateOrganization` accepts
export function isOrganizationSlug(value: string) {
  return value.length <= ORGANIZATION_SLUG_MAX_LENGTH && ORGANIZATION_SLUG_PATTERN.test(value)
}

// The unique index Data Connect builds on `Organization.slug`, named after the table and column
const ORGANIZATION_SLUG_INDEX = 'organization_slug_uidx'

/*
  Whether a write failed because another organization holds the slug it gave. The message of the
  error Data Connect answers names the index, in the web SDK's errors and the Admin SDK's alike,
  and nothing else a write of a slug does can trip it: a writer told so draws another and tries
  again
*/
export function isOrganizationSlugTakenError(error: unknown) {
  return error instanceof Error && error.message.includes(ORGANIZATION_SLUG_INDEX)
}
