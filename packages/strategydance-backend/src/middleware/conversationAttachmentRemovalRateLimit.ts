import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  The removals of unsent files from conversations' drafts, metered apart from the uploads, so
  removing what one uploaded never takes from what one may upload: 120 per caller in 10 minutes,
  keyed and counted as `conversationAttachmentUploadRateLimitMiddleware` is
*/
const conversationAttachmentRemovalRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many files removed, try again later')
  },
})

export default conversationAttachmentRemovalRateLimitMiddleware
