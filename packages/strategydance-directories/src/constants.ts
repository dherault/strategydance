import { DirectoryBusinessModel, DirectoryInactiveReason } from './enums'
import type { Directory, InactiveDirectory } from './types'

/*
  What each business model means, in the words a person reads here and the checker's prompt gives
  Claude, so the two never say different things
*/
export const DIRECTORY_BUSINESS_MODEL_DESCRIPTIONS: Record<DirectoryBusinessModel, string> = {
  [DirectoryBusinessModel.FREE]: 'Listed for free, with nothing sold beside it',
  [DirectoryBusinessModel.FREE_WITH_BADGE]:
    "The free listing needs the directory's badge, or a link to it, on your site, or a link exchange",
  [DirectoryBusinessModel.FREE_WITH_GATE]:
    'Free only to some startups: a region, an audience, a kind of product, or what not every startup has, such as a work email, a phone number, a postal address or verified revenue',
  [DirectoryBusinessModel.FREE_WITH_LONG_QUEUE]: 'The free listing waits about a month or more',
  [DirectoryBusinessModel.FREE_WITH_PAID_SKIP]:
    'The free listing waits less than a month, and paying publishes it sooner',
  [DirectoryBusinessModel.FREE_WITH_ENGAGEMENT]:
    'The free listing needs upvotes, comments or reviews on other products first',
  [DirectoryBusinessModel.FREE_WITH_CURATION]:
    'Editors pick what is listed, so a submission is a suggestion they may never take up',
  [DirectoryBusinessModel.FREE_WITH_PAID_PROMOTION]:
    'The free listing has no catch, and featuring, boosts, pins or sponsored slots are sold beside it',
  [DirectoryBusinessModel.FREE_FOR_LIMITED_TIME]:
    'Free for now, during a beta or for the first members, with no price said for after',
  [DirectoryBusinessModel.PAID]: 'Only a paid listing, a free one advertised but never open included',
  [DirectoryBusinessModel.UNKNOWN]: 'No submission path was found, or none was tried',
}

/*
  Which model a directory with a free path takes. Most combine several catches, a badge with a long
  queue and a paid skip being common, so a directory takes the first of these that applies; one
  with no free path is `PAID`, and one nobody could tell is `UNKNOWN`.

  A gate comes late on purpose: who may apply is not how a directory earns, and a directory for AI
  tools that sells a skip of its two-year queue is better described by the queue
*/
export const DIRECTORY_BUSINESS_MODEL_PRECEDENCE = [
  DirectoryBusinessModel.FREE_WITH_BADGE,
  DirectoryBusinessModel.FREE_WITH_CURATION,
  DirectoryBusinessModel.FREE_WITH_LONG_QUEUE,
  DirectoryBusinessModel.FREE_WITH_ENGAGEMENT,
  DirectoryBusinessModel.FREE_WITH_PAID_SKIP,
  DirectoryBusinessModel.FREE_WITH_GATE,
  DirectoryBusinessModel.FREE_FOR_LIMITED_TIME,
  DirectoryBusinessModel.FREE_WITH_PAID_PROMOTION,
  DirectoryBusinessModel.FREE,
] as const

/*
  What each reason means. A site whose submissions are closed for a while is inactive too, since
  nothing can be submitted there today, and a later check brings it back
*/
export const DIRECTORY_INACTIVE_REASON_DESCRIPTIONS: Record<DirectoryInactiveReason, string> = {
  [DirectoryInactiveReason.UNREACHABLE]:
    'Does not resolve, refuses or drops every connection, fails TLS, or its server only errors',
  [DirectoryInactiveReason.PARKED]:
    "Parked, for sale or expired, a host's default page, or a suspended hosting account",
  [DirectoryInactiveReason.REPURPOSED]:
    'The domain now serves something else, or sends visitors on to an unrelated site',
  [DirectoryInactiveReason.NO_SUBMISSION]:
    'Up, with no way to submit: it never had one, removed it, paused it, or the site has closed',
  [DirectoryInactiveReason.BROKEN_SUBMISSION]:
    'The way to submit is there and fails: a form that sends nothing, a sign-in that breaks, an address that bounces, or a queue nobody reads',
  [DirectoryInactiveReason.CLOSED_TO_PROMOTION]:
    'A community closed to promotion: its rules ban it, or Reddit banned the community',
}

/*
  Each entry's fields, in the order the files hold them, which is the order whatever writes them
  keeps. Records rather than lists, so the typechecker refuses a field missing from them or one the
  types lack
*/
const DIRECTORY_FIELD_ORDER: Record<keyof Directory, true> = {
  name: true,
  type: true,
  rootUrl: true,
  submissionUrl: true,
  description: true,
  businessModel: true,
  lastChecked: true,
  unreachableSince: true,
}

const INACTIVE_DIRECTORY_EXTRA_FIELD_ORDER: Record<Exclude<keyof InactiveDirectory, keyof Directory>, true> = {
  inactiveReason: true,
}

export const DIRECTORY_FIELDS = Object.keys(DIRECTORY_FIELD_ORDER) as readonly (keyof Directory)[]

export const INACTIVE_DIRECTORY_FIELDS = [
  ...DIRECTORY_FIELDS,
  ...Object.keys(INACTIVE_DIRECTORY_EXTRA_FIELD_ORDER),
] as readonly (keyof InactiveDirectory)[]

// The longest description, in characters: one sentence
export const MAX_DIRECTORY_DESCRIPTION_LENGTH = 200
