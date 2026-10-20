import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import { KNOWLEDGE_REVISION_RATE_LIMIT, KNOWLEDGE_REVISION_RATE_WINDOW_MS } from '~constants'

import respondError from '~utils/respondError'

/*
  A member's reads of what their conversations' edits can undo and their restores of documents'
  revisions, metered together: 60 per caller in 10 minutes, which a thread refetching on focus and
  a member going back through a history stay under, while each one merges a whole document's text
  in the instance.

  Keyed by the verified caller, as `richTextImageRateLimitMiddleware` is and for the same reasons,
  and counted in the instance's memory the same way
*/
const knowledgeRevisionRateLimitMiddleware = rateLimit({
  windowMs: KNOWLEDGE_REVISION_RATE_WINDOW_MS,
  limit: KNOWLEDGE_REVISION_RATE_LIMIT,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many versions read or restored, try again later')
  },
})

export default knowledgeRevisionRateLimitMiddleware
