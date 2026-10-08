import { ERROR_CODE_CONFLICT, ERROR_CODE_SERVICE_UNAVAILABLE } from 'strategydance-core'

import { ApiError } from '~data/api'

// Why an answer could not be sent, as far as the reader can do something about it
export type ConversationAnswerFailure = 'conflict' | 'unavailable' | 'error'

/*
  What a failed answer tells the reader: a question answered or skipped elsewhere meanwhile, whose
  thread shows how, or an answer kept that the server cannot follow up now, which it will. Any other
  failure, a connection lost on the way included, is one the same answer may get past later
*/
function getConversationAnswerFailure(error: unknown): ConversationAnswerFailure {
  if (!(error instanceof ApiError)) return 'error'
  if (error.code === ERROR_CODE_CONFLICT) return 'conflict'
  if (error.code === ERROR_CODE_SERVICE_UNAVAILABLE || error.status === 503) return 'unavailable'

  return 'error'
}

export default getConversationAnswerFailure
