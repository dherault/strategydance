import type { ConversationCapFailure, ConversationSendFailure } from '~utils/conversation/getConversationSendFailure'

const CAP_FAILURES: readonly ConversationSendFailure[] = [
  'memberConversationsCapped',
  'accountConversationsCapped',
  'organizationConversationsCapped',
  'memberRunsCapped',
  'accountRunsCapped',
  'organizationRunsCapped',
]

// Whether a failed send, resume or retry reached a daily cap, which says when it has room again
function isConversationCapFailure(failure: ConversationSendFailure | null): failure is ConversationCapFailure {
  return failure !== null && CAP_FAILURES.includes(failure)
}

export default isConversationCapFailure
