import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import {
  CONVERSATION_SEARCH_WINDOW_MINUTES,
  ERROR_CODE_TOO_MANY_REQUESTS,
  MAX_CONVERSATION_SEARCHES,
} from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  The search route's requests, metered: 120 per caller in ten minutes, which somebody typing in the
  search field never reaches and a script does. It turns a script away before anything reads the
  database, and the database holds the same allowance across instances, per member and organization,
  in `searchConversations`.

  Keyed by the verified caller rather than the address, since one office shares an address and
  one caller can hold many. It runs after `authenticationMiddleware`, and falls back to the
  address only if it ever does not.

  Counted in the instance's memory, so each limiter made is one instance's count: the conversations
  router makes its own, once, and a test makes a second router to stand for another instance
*/
function createConversationSearchRateLimitMiddleware() {
  return rateLimit({
    windowMs: CONVERSATION_SEARCH_WINDOW_MINUTES * 60 * 1000,
    limit: MAX_CONVERSATION_SEARCHES,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
    handler: (_request, response) => {
      respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many searches, try again in a few minutes')
    },
  })
}

export default createConversationSearchRateLimitMiddleware
