import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  The uploads of pictures for documents' text, metered: 60 per caller in 10 minutes, which a page
  of screenshots pasted one after the other stays under and a script filling the bucket does not.

  Keyed by the verified caller, as `organizationImageRateLimitMiddleware` is and for the same
  reasons, and counted in the instance's memory the same way
*/
const richTextImageRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many pictures uploaded, try again later')
  },
})

export default richTextImageRateLimitMiddleware
