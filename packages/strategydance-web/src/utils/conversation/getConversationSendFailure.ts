import {
  ERROR_CODE_ACCOUNT_DAILY_CONVERSATIONS_REACHED,
  ERROR_CODE_ACCOUNT_DAILY_RUNS_REACHED,
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_CONVERSATION_ATTACHMENTS_OVER_BUDGET,
  ERROR_CODE_CONVERSATION_BUSY,
  ERROR_CODE_CONVERSATION_FULL,
  ERROR_CODE_MEMBER_DAILY_CONVERSATIONS_REACHED,
  ERROR_CODE_MEMBER_DAILY_RUNS_REACHED,
  ERROR_CODE_ORGANIZATION_DAILY_CONVERSATIONS_REACHED,
  ERROR_CODE_ORGANIZATION_DAILY_RUNS_REACHED,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_CONVERSATIONS,
} from 'strategydance-core'

import getConversationAccessFailure, {
  type ConversationAccessFailure,
} from '~utils/conversation/getConversationAccessFailure'

import { ApiError } from '~data/api'

// A daily cap a start reached: on the conversations or the runs the reader starts, theirs in the
// organization, their account's across its organizations, or the organization's
export type ConversationCapFailure =
  | 'memberConversationsCapped'
  | 'accountConversationsCapped'
  | 'organizationConversationsCapped'
  | 'memberRunsCapped'
  | 'accountRunsCapped'
  | 'organizationRunsCapped'

// Why a message could not be sent, as far as the reader can do something about it
export type ConversationSendFailure =
  | 'busy'
  | 'full'
  | 'tooMany'
  | 'overBudget'
  | 'filesGone'
  | 'unavailable'
  | 'error'
  | ConversationCapFailure
  | ConversationAccessFailure

const CAP_FAILURES: Record<string, ConversationCapFailure> = {
  [ERROR_CODE_MEMBER_DAILY_CONVERSATIONS_REACHED]: 'memberConversationsCapped',
  [ERROR_CODE_ACCOUNT_DAILY_CONVERSATIONS_REACHED]: 'accountConversationsCapped',
  [ERROR_CODE_ORGANIZATION_DAILY_CONVERSATIONS_REACHED]: 'organizationConversationsCapped',
  [ERROR_CODE_MEMBER_DAILY_RUNS_REACHED]: 'memberRunsCapped',
  [ERROR_CODE_ACCOUNT_DAILY_RUNS_REACHED]: 'accountRunsCapped',
  [ERROR_CODE_ORGANIZATION_DAILY_RUNS_REACHED]: 'organizationRunsCapped',
}

/*
  What a failed send tells the reader: a run already going, a conversation that holds as much as
  it can, as many conversations kept as the member may, files the conversation has no room for, or
  a server that cannot take it now. A message sending files that is refused as malformed, or as in
  conflict, names files the backend no longer holds ready, as when one waited past the two days an
  unsent file is kept: they have to go up again. A daily cap reached says which, its refusal's
  `Retry-After` saying when it has room (`getConversationFailureRetryAt`). An address not confirmed,
  or conversations suspended, says so. Any other failure, a connection lost on the way included, is
  one the same send may get past later, so it reads as such
*/
function getConversationSendFailure(error: unknown, hasFiles = false): ConversationSendFailure {
  if (!(error instanceof ApiError)) return 'error'
  if (CAP_FAILURES[error.code]) return CAP_FAILURES[error.code]!

  const accessFailure = getConversationAccessFailure(error)

  if (accessFailure) return accessFailure
  if (error.code === ERROR_CODE_CONVERSATION_BUSY) return 'busy'
  if (error.code === ERROR_CODE_CONVERSATION_FULL) return 'full'
  if (error.code === ERROR_CODE_TOO_MANY_CONVERSATIONS) return 'tooMany'
  if (error.code === ERROR_CODE_CONVERSATION_ATTACHMENTS_OVER_BUDGET) return 'overBudget'
  if (hasFiles && (error.code === ERROR_CODE_BAD_REQUEST || error.code === ERROR_CODE_CONFLICT)) return 'filesGone'
  if (error.code === ERROR_CODE_SERVICE_UNAVAILABLE || error.status === 503) return 'unavailable'

  return 'error'
}

export default getConversationSendFailure
