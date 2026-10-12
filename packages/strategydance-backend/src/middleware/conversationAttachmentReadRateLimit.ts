import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  The reads of conversations' files, metered generously: 600 per caller in 10 minutes, since a
  thread draws a thumbnail of each of its images, up to 100 files a conversation, and a reader opens
  several. Keyed and counted as `conversationAttachmentUploadRateLimitMiddleware` is
*/
const conversationAttachmentReadRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many files read, try again later')
  },
})

export default conversationAttachmentReadRateLimitMiddleware
