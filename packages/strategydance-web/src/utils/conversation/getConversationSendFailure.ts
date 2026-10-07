import {
  ERROR_CODE_CONVERSATION_BUSY,
  ERROR_CODE_CONVERSATION_FULL,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_CONVERSATIONS,
} from 'strategydance-core'

import { ApiError } from '~data/api'

// Why a message could not be sent, as far as the reader can do something about it
export type ConversationSendFailure = 'busy' | 'full' | 'tooMany' | 'unavailable' | 'error'

/*
  What a failed send tells the reader: a run already going, a conversation that holds as much as
  it can, as many conversations kept as the member may, or a server that cannot take it now. Any
  other failure, a connection lost on the way included, is one the same send may get past later,
  so it reads as such
*/
function getConversationSendFailure(error: unknown): ConversationSendFailure {
  if (!(error instanceof ApiError)) return 'error'
  if (error.code === ERROR_CODE_CONVERSATION_BUSY) return 'busy'
  if (error.code === ERROR_CODE_CONVERSATION_FULL) return 'full'
  if (error.code === ERROR_CODE_TOO_MANY_CONVERSATIONS) return 'tooMany'
  if (error.code === ERROR_CODE_SERVICE_UNAVAILABLE || error.status === 503) return 'unavailable'

  return 'error'
}

export default getConversationSendFailure
