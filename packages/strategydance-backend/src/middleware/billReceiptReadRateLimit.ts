import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  The reads of bills' receipts, metered: 600 per caller in 10 minutes, as many as a conversation's
  files take, which a member opening receipt after receipt stays under and a script copying the
  bucket out does not.

  Keyed by the verified caller, as `billReceiptUploadRateLimitMiddleware` is, and counted in the
  instance's memory the same way
*/
const billReceiptReadRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many receipts read, try again later')
  },
})

export default billReceiptReadRateLimitMiddleware
