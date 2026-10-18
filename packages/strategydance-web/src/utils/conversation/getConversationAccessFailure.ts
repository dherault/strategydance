import { ERROR_CODE_CONVERSATIONS_SUSPENDED, ERROR_CODE_EMAIL_NOT_VERIFIED } from 'strategydance-core'

import { ApiError } from '~data/api'

// Why the backend refuses the reader whatever they send to a conversation, a message, an answer, an
// approval, a resume, a retry or a file: their address is not confirmed, or staff suspended their
// conversations, their account's or the organization's
export type ConversationAccessFailure = 'unverified' | 'suspended'

// Which of the two a refusal is, or null for any other failure
function getConversationAccessFailure(error: unknown): ConversationAccessFailure | null {
  if (!(error instanceof ApiError)) return null
  if (error.code === ERROR_CODE_EMAIL_NOT_VERIFIED) return 'unverified'
  if (error.code === ERROR_CODE_CONVERSATIONS_SUSPENDED) return 'suspended'

  return null
}

export default getConversationAccessFailure
