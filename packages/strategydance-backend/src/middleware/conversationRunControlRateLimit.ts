import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  The reconciles and the stops of conversations' runs and subagents, which start nothing, so neither
  a daily cap nor a verified address meters them, while each can ask Cloud Tasks about a run, end
  runs and promote others: 300 per caller in 10 minutes, keyed as the uploads are. A page asks a
  run's reconcile and its subagents' every two minutes while one is busy, so even a reader with every
  window of the dock open in a few tabs stays well under it
*/
const conversationRunControlRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many reconciles or stops, try again later')
  },
})

export default conversationRunControlRateLimitMiddleware
