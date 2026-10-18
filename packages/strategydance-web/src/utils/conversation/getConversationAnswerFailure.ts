import { ERROR_CODE_CONFLICT, ERROR_CODE_SERVICE_UNAVAILABLE } from 'strategydance-core'

import getConversationAccessFailure, {
  type ConversationAccessFailure,
} from '~utils/conversation/getConversationAccessFailure'

import { ApiError } from '~data/api'

// Why an answer could not be sent, as far as the reader can do something about it
export type ConversationAnswerFailure = 'conflict' | 'unavailable' | 'error' | ConversationAccessFailure

/*
  What a failed answer tells the reader: a question answered or skipped elsewhere meanwhile, whose
  thread shows how, or an answer kept that the server cannot follow up now, which it will. Only the
  answer route's own refusal says the answer is kept: a 503 from a proxy, before the route ran, says
  nothing of it. An address not confirmed, or conversations suspended, says so. Any other failure, a
  connection lost on the way included, is one the same answer may get past later
*/
function getConversationAnswerFailure(error: unknown): ConversationAnswerFailure {
  if (!(error instanceof ApiError)) return 'error'

  const accessFailure = getConversationAccessFailure(error)

  if (accessFailure) return accessFailure
  if (error.code === ERROR_CODE_CONFLICT) return 'conflict'
  if (error.code === ERROR_CODE_SERVICE_UNAVAILABLE) return 'unavailable'

  return 'error'
}

export default getConversationAnswerFailure
