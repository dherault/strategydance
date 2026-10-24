/*
  Const objects rather than TypeScript `enum`s, so each name is a value and a type at once and no
  runtime enum object is emitted into the frontend bundle. That is why `import { Locale } from
  'strategydance-core'` works in both positions
*/

// Uppercase, and lowercased only at the boundaries: `document.documentElement.lang` and the
// translation prompt
export const Locale = {
  EN: 'EN',
  FR: 'FR',
  ES: 'ES',
  DE: 'DE',
  PT: 'PT',
  ZH: 'ZH',
  JA: 'JA',
} as const

export type Locale = (typeof Locale)[keyof typeof Locale]

/*
  The currencies a bill is paid in and a budget is set in: the 30 the European Central Bank
  publishes a daily rate for, since every amount the Budget computes is converted at the ECB's rate
  of its payment's day. Declared in `schema.gql` as well, which cannot read this, and
  `schema.test.ts` in strategydance-database fails when the two disagree
*/
export const Currency = {
  AUD: 'AUD',
  BRL: 'BRL',
  CAD: 'CAD',
  CHF: 'CHF',
  CNY: 'CNY',
  CZK: 'CZK',
  DKK: 'DKK',
  EUR: 'EUR',
  GBP: 'GBP',
  HKD: 'HKD',
  HUF: 'HUF',
  IDR: 'IDR',
  ILS: 'ILS',
  INR: 'INR',
  ISK: 'ISK',
  JPY: 'JPY',
  KRW: 'KRW',
  MXN: 'MXN',
  MYR: 'MYR',
  NOK: 'NOK',
  NZD: 'NZD',
  PHP: 'PHP',
  PLN: 'PLN',
  RON: 'RON',
  SEK: 'SEK',
  SGD: 'SGD',
  THB: 'THB',
  TRY: 'TRY',
  USD: 'USD',
  ZAR: 'ZAR',
} as const

export type Currency = (typeof Currency)[keyof typeof Currency]
