import {
  DAILY_CAP_OVERRUN_FACTOR,
  DAILY_CAP_WINDOW_HOURS,
  MAX_DAILY_CONVERSATIONS_PER_ACCOUNT,
  MAX_DAILY_CONVERSATIONS_PER_MEMBER,
  MAX_DAILY_CONVERSATIONS_PER_ORGANIZATION,
  MAX_DAILY_RUNS_PER_ACCOUNT,
  MAX_DAILY_RUNS_PER_MEMBER,
  MAX_DAILY_RUNS_PER_ORGANIZATION,
  MAX_DAILY_SUBAGENTS_PER_ACCOUNT,
  MAX_DAILY_SUBAGENTS_PER_MEMBER,
} from 'strategydance-core'
import type { GetCappedStartsData } from 'strategydance-database/backend'

import type { ReachedUsageCap, UsageCapKind, UsageCapScope } from '~types'

const WINDOW_MS = DAILY_CAP_WINDOW_HOURS * 60 * 60 * 1000

// Each cap by what it counts and whose: subagents have no organization's
const USAGE_CAPS: Record<UsageCapKind, Partial<Record<UsageCapScope, number>>> = {
  conversations: {
    member: MAX_DAILY_CONVERSATIONS_PER_MEMBER,
    account: MAX_DAILY_CONVERSATIONS_PER_ACCOUNT,
    organization: MAX_DAILY_CONVERSATIONS_PER_ORGANIZATION,
  },
  runs: {
    member: MAX_DAILY_RUNS_PER_MEMBER,
    account: MAX_DAILY_RUNS_PER_ACCOUNT,
    organization: MAX_DAILY_RUNS_PER_ORGANIZATION,
  },
  subagents: {
    member: MAX_DAILY_SUBAGENTS_PER_MEMBER,
    account: MAX_DAILY_SUBAGENTS_PER_ACCOUNT,
  },
}

// Where `GetCappedStarts` answers each, newest first
const STARTS_READ: Record<UsageCapKind, Partial<Record<UsageCapScope, keyof GetCappedStartsData>>> = {
  conversations: {
    member: 'memberConversations',
    account: 'accountConversations',
    organization: 'organizationConversations',
  },
  runs: { member: 'memberRuns', account: 'accountRuns', organization: 'organizationRuns' },
  subagents: { member: 'memberSubagents', account: 'accountSubagents' },
}

type Options = {
  // Whether the start finishes work under way, an answer's continuation, an Allow's or a reaction,
  // which passes each cap up to one and a half times it
  isFinishing?: boolean
  now?: number
}

/*
  The daily cap a start of each kind given reaches, from the starts the caps counted in the last 24
  hours, or null when every one has room: the member's, the account's or the organization's, held to
  its cap, or to one and a half times it for what finishes work under way. A count can pass its cap,
  as what finishes work under way passes it and starts at once in two organizations or by two
  members can each pass it by one, so only the newest rows say when it has room: the one as many
  rows back as the cap allows, once it is 24 hours old. Of several caps reached, the one that has
  room last, since the start can go only then
*/
function findReachedUsageCap(
  starts: GetCappedStartsData,
  kinds: UsageCapKind[],
  { isFinishing = false, now = Date.now() }: Options = {},
): ReachedUsageCap | null {
  let reached: ReachedUsageCap | null = null

  for (const kind of kinds) {
    for (const [scope, cap] of Object.entries(USAGE_CAPS[kind]) as [UsageCapScope, number][]) {
      // Whole, as the mutations write it out: an odd cap's half would name no row
      const max = isFinishing ? Math.floor(cap * DAILY_CAP_OVERRUN_FACTOR) : cap
      const field = STARTS_READ[kind][scope]
      const newest = field ? starts[field] : []
      const oldest = newest[max - 1]

      if (!oldest) continue

      const retryAfterMs = Math.max(0, Date.parse(oldest.createdAt) + WINDOW_MS - now)

      if (!reached || retryAfterMs > reached.retryAfterMs) reached = { kind, scope, max, retryAfterMs }
    }
  }

  return reached
}

export default findReachedUsageCap
