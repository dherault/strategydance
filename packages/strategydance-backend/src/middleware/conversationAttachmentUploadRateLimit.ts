import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  The uploads of files to conversations, metered: 120 per caller in 10 minutes, which a member
  attaching, removing and attaching again a tray's worth of files stays under and a script filling
  the bucket does not. Their quota of 30 unsent files bounds what is kept; this bounds the bytes
  carried.

  Keyed by the verified caller, as `richTextImageRateLimitMiddleware` is and for the same reasons,
  and counted in the instance's memory the same way
*/
const conversationAttachmentUploadRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many files uploaded, try again later')
  },
})

export default conversationAttachmentUploadRateLimitMiddleware
