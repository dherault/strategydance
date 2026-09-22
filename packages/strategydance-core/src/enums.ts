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
