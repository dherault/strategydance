import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import { ApiError } from '~data/api'

// Why a search failed, as far as the reader can do something about it
export type ConversationSearchFailure = 'tooMany' | 'error'

/*
  What a failed search tells the reader: as many searches in a few minutes as anybody may make,
  which only waiting gets past, or any other failure, a connection lost on the way included, which
  the same search may get past now
*/
function getConversationSearchFailure(error: unknown): ConversationSearchFailure {
  if (error instanceof ApiError && (error.code === ERROR_CODE_TOO_MANY_REQUESTS || error.status === 429)) {
    return 'tooMany'
  }

  return 'error'
}

export default getConversationSearchFailure
