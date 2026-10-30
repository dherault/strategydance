/*
  Const objects rather than TypeScript `enum`s, as in strategydance-core, so each name is a value
  and a type at once and no runtime enum object is emitted
*/

/*
  Where a tactic reaches people, one per tactic. What each one means is
  `MARKETING_TACTIC_CHANNEL_DESCRIPTIONS`, in `constants.ts`
*/
export const MarketingTacticChannel = {
  SOCIAL_MEDIA: 'SOCIAL_MEDIA',
  COMMUNITIES: 'COMMUNITIES',
  CONTENT: 'CONTENT',
  SEO: 'SEO',
  EMAIL: 'EMAIL',
  OUTREACH: 'OUTREACH',
  ADVERTISING: 'ADVERTISING',
  PARTNERSHIPS: 'PARTNERSHIPS',
  LAUNCHES: 'LAUNCHES',
  EVENTS: 'EVENTS',
  PROMOTIONS: 'PROMOTIONS',
  PRESS: 'PRESS',
  PRODUCT: 'PRODUCT',
  REFERRALS: 'REFERRALS',
} as const

export type MarketingTacticChannel = (typeof MarketingTacticChannel)[keyof typeof MarketingTacticChannel]

// How much of the team's time a tactic takes, which `MARKETING_TACTIC_EFFORT_DESCRIPTIONS` says
export const MarketingTacticEffort = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const

export type MarketingTacticEffort = (typeof MarketingTacticEffort)[keyof typeof MarketingTacticEffort]

// How soon a tactic shows results, which `MARKETING_TACTIC_TIME_TO_RESULTS_DESCRIPTIONS` says
export const MarketingTacticTimeToResults = {
  DAYS: 'DAYS',
  WEEKS: 'WEEKS',
  MONTHS: 'MONTHS',
} as const

export type MarketingTacticTimeToResults =
  (typeof MarketingTacticTimeToResults)[keyof typeof MarketingTacticTimeToResults]
