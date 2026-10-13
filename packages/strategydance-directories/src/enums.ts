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
  them. Most directories combine several catches, a badge with a long queue and a paid skip being
  common, so a directory takes the first of these that applies:

  1. FREE_WITH_BADGE
  2. FREE_WITH_CURATION
  3. FREE_WITH_LONG_QUEUE
  4. FREE_WITH_ENGAGEMENT
  5. FREE_WITH_PAID_SKIP
  6. FREE_WITH_GATE
  7. FREE_FOR_LIMITED_TIME
  8. FREE_WITH_PAID_PROMOTION
  9. FREE

  A gate comes late on purpose: who may apply is not how a directory earns, and a directory for AI
  tools that sells a skip of its two-year queue is better described by the queue
*/
export const DirectoryBusinessModel = {
  // Listed for free, with nothing sold beside it
  FREE: 'FREE',
  // The free listing needs the directory's badge, or a link to it, on your site, or a link exchange
  FREE_WITH_BADGE: 'FREE_WITH_BADGE',
  // Free only to some startups: a region, an audience, a kind of product, or what not every
  // startup has, such as a work email, a phone number, a postal address or verified revenue
  FREE_WITH_GATE: 'FREE_WITH_GATE',
  // The free listing waits about a month or more
  FREE_WITH_LONG_QUEUE: 'FREE_WITH_LONG_QUEUE',
  // The free listing waits less than a month, and paying publishes it sooner
  FREE_WITH_PAID_SKIP: 'FREE_WITH_PAID_SKIP',
  // The free listing needs upvotes, comments or reviews on other products first
  FREE_WITH_ENGAGEMENT: 'FREE_WITH_ENGAGEMENT',
  // Editors pick what is listed, so a submission is a suggestion they may never take up
  FREE_WITH_CURATION: 'FREE_WITH_CURATION',
  // The free listing has no catch, and featuring, boosts, pins or sponsored slots are sold beside it
  FREE_WITH_PAID_PROMOTION: 'FREE_WITH_PAID_PROMOTION',
  // Free for now, during a beta or for the first members, with no price said for after
  FREE_FOR_LIMITED_TIME: 'FREE_FOR_LIMITED_TIME',
  // Only a paid listing, a free one advertised but never open included
  PAID: 'PAID',
  // No submission path was found, or none was tried
  UNKNOWN: 'UNKNOWN',
} as const

export type DirectoryBusinessModel = (typeof DirectoryBusinessModel)[keyof typeof DirectoryBusinessModel]

/*
  Why a directory is in the inactive list, read from what it showed when it was last checked. A
  site whose submission is closed for a while is inactive too, since nothing can be submitted there
  today, and a later check brings it back
*/
export const DirectoryInactiveReason = {
  // Does not resolve, refuses or drops every connection, fails TLS, or its server only errors
  UNREACHABLE: 'UNREACHABLE',
  // Parked, for sale or expired, a host's default page, or a suspended hosting account
  PARKED: 'PARKED',
  // The domain now serves something else, or sends visitors on to an unrelated site
  REPURPOSED: 'REPURPOSED',
  // Up, with no way to submit: it never had one, removed it, paused it, or the site has closed
  NO_SUBMISSION: 'NO_SUBMISSION',
  // The way to submit is there and fails: a form that sends nothing, a sign-in that breaks, an
  // address that bounces, or a queue nobody reads
  BROKEN_SUBMISSION: 'BROKEN_SUBMISSION',
  // A community closed to promotion: its rules ban it, or Reddit banned the community
  CLOSED_TO_PROMOTION: 'CLOSED_TO_PROMOTION',
} as const

export type DirectoryInactiveReason = (typeof DirectoryInactiveReason)[keyof typeof DirectoryInactiveReason]
