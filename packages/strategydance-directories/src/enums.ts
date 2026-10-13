/*
  Const objects rather than TypeScript `enum`s, as in strategydance-core, so each name is a value
  and a type at once and no runtime enum object is emitted
*/

export const DirectoryType = {
  WEBSITE: 'WEBSITE',
  REDDIT_COMMUNITY: 'REDDIT_COMMUNITY',
} as const

export type DirectoryType = (typeof DirectoryType)[keyof typeof DirectoryType]

/*
  How a directory makes money from the startups it lists, read from what its free path asks of
  them. What each one means is `DIRECTORY_BUSINESS_MODEL_DESCRIPTIONS`, and which one a directory
  with several catches takes is `DIRECTORY_BUSINESS_MODEL_PRECEDENCE`, both in `constants.ts`, the
  words the checker's prompt is built from
*/
export const DirectoryBusinessModel = {
  FREE: 'FREE',
  FREE_WITH_BADGE: 'FREE_WITH_BADGE',
  FREE_WITH_GATE: 'FREE_WITH_GATE',
  FREE_WITH_LONG_QUEUE: 'FREE_WITH_LONG_QUEUE',
  FREE_WITH_PAID_SKIP: 'FREE_WITH_PAID_SKIP',
  FREE_WITH_ENGAGEMENT: 'FREE_WITH_ENGAGEMENT',
  FREE_WITH_CURATION: 'FREE_WITH_CURATION',
  FREE_WITH_PAID_PROMOTION: 'FREE_WITH_PAID_PROMOTION',
  FREE_FOR_LIMITED_TIME: 'FREE_FOR_LIMITED_TIME',
  PAID: 'PAID',
  UNKNOWN: 'UNKNOWN',
} as const

export type DirectoryBusinessModel = (typeof DirectoryBusinessModel)[keyof typeof DirectoryBusinessModel]

/*
  Why a directory is in the inactive list, read from what it showed when it was last checked. What
  each one means is `DIRECTORY_INACTIVE_REASON_DESCRIPTIONS`, in `constants.ts`
*/
export const DirectoryInactiveReason = {
  UNREACHABLE: 'UNREACHABLE',
  PARKED: 'PARKED',
  REPURPOSED: 'REPURPOSED',
  NO_SUBMISSION: 'NO_SUBMISSION',
  BROKEN_SUBMISSION: 'BROKEN_SUBMISSION',
  CLOSED_TO_PROMOTION: 'CLOSED_TO_PROMOTION',
} as const

export type DirectoryInactiveReason = (typeof DirectoryInactiveReason)[keyof typeof DirectoryInactiveReason]
