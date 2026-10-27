import type { Response } from 'express'
import {
  ERROR_CODE_ACCOUNT_DAILY_CONVERSATIONS_REACHED,
  ERROR_CODE_ACCOUNT_DAILY_RUNS_REACHED,
  ERROR_CODE_ACCOUNT_DAILY_SPEND_REACHED,
  ERROR_CODE_MEMBER_DAILY_CONVERSATIONS_REACHED,
  ERROR_CODE_MEMBER_DAILY_RUNS_REACHED,
  ERROR_CODE_MEMBER_DAILY_SPEND_REACHED,
  ERROR_CODE_ORGANIZATION_DAILY_CONVERSATIONS_REACHED,
  ERROR_CODE_ORGANIZATION_DAILY_RUNS_REACHED,
  ERROR_CODE_ORGANIZATION_DAILY_SPEND_REACHED,
  ERROR_CODE_RECEIPT_READS_CAPPED,
  ERROR_CODE_TOO_MANY_REQUESTS,
} from 'strategydance-core'

import type { ReachedUsageCap, UsageCapScope } from '~types'

import respondError from '~utils/respondError'

// Each cap a member's start can reach, by what it counts and whose, a daily spend ceiling and the
// receipt reader's among them. A launch is the agent's, which no route answers
const ERROR_CODES: Record<ReachedUsageCap['kind'], Partial<Record<UsageCapScope, string>>> = {
  conversations: {
    member: ERROR_CODE_MEMBER_DAILY_CONVERSATIONS_REACHED,
    account: ERROR_CODE_ACCOUNT_DAILY_CONVERSATIONS_REACHED,
    organization: ERROR_CODE_ORGANIZATION_DAILY_CONVERSATIONS_REACHED,
  },
  runs: {
    member: ERROR_CODE_MEMBER_DAILY_RUNS_REACHED,
    account: ERROR_CODE_ACCOUNT_DAILY_RUNS_REACHED,
    organization: ERROR_CODE_ORGANIZATION_DAILY_RUNS_REACHED,
  },
  subagents: {},
  spend: {
    member: ERROR_CODE_MEMBER_DAILY_SPEND_REACHED,
    account: ERROR_CODE_ACCOUNT_DAILY_SPEND_REACHED,
    organization: ERROR_CODE_ORGANIZATION_DAILY_SPEND_REACHED,
  },
  receiptReads: {
    member: ERROR_CODE_RECEIPT_READS_CAPPED,
    organization: ERROR_CODE_RECEIPT_READS_CAPPED,
  },
}

const WHOSE: Record<UsageCapScope, string> = {
  member: 'You started {max} {kind} in this organization in the last 24 hours',
  account: 'You started {max} {kind} across your organizations in the last 24 hours',
  organization: 'This organization started {max} {kind} in the last 24 hours',
}

const WHOSE_READS: Record<UsageCapScope, string> = {
  member: 'Strategy Dance read {max} of your receipts in this organization in the last 24 hours',
  account: 'Strategy Dance read {max} of your receipts in the last 24 hours',
  organization: "Strategy Dance read {max} of this organization's receipts in the last 24 hours",
}

const WHOSE_SPEND: Record<UsageCapScope, string> = {
  member: 'Your conversations in this organization cost as much as the {max} they may in 24 hours',
  account: 'Your conversations across your organizations cost as much as the {max} they may in 24 hours',
  organization: "This organization's conversations cost as much as the {max} they may in 24 hours",
}

/*
  Refuses a start a daily cap held back: a 429 with the cap's own code, and a `Retry-After`, in
  seconds, until it has room again, at least one, as the oldest start may have aged out between the
  read and now. The backend's `cors` exposes the header, which a page on another origin cannot read
  otherwise
*/
function respondUsageCapped(response: Response, cap: ReachedUsageCap) {
  response.setHeader('Retry-After', Math.max(1, Math.ceil(cap.retryAfterMs / 1000)))
  respondError(
    response,
    429,
    ERROR_CODES[cap.kind][cap.scope] ?? ERROR_CODE_TOO_MANY_REQUESTS,
    cap.kind === 'spend'
      ? WHOSE_SPEND[cap.scope].replace('{max}', `$${cap.max / 1_000_000}`)
      : cap.kind === 'receiptReads'
        ? `${WHOSE_READS[cap.scope].replace('{max}', String(cap.max))}, the most allowed`
        : `${WHOSE[cap.scope].replace('{max}', String(cap.max)).replace('{kind}', cap.kind === 'runs' ? 'responses' : cap.kind)}, the most allowed`,
  )
}

export default respondUsageCapped
