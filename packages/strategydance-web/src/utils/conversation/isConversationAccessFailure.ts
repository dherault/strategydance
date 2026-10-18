import type { ConversationAccessFailure } from '~utils/conversation/getConversationAccessFailure'

const ACCESS_FAILURES: readonly string[] = ['unverified', 'suspended'] satisfies ConversationAccessFailure[]

// Whether a failure is one the composer's notice says rather than a line of its own: an address not
// confirmed, or conversations suspended
function isConversationAccessFailure<Failure extends string>(
  failure: Failure | null,
): failure is Extract<Failure, ConversationAccessFailure> {
  return failure !== null && ACCESS_FAILURES.includes(failure)
}

export default isConversationAccessFailure
