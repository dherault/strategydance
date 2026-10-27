import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  The receipt reader's asks, metered: 30 per caller in 10 minutes, which a member uploading a month
  of invoices one after the other stays under. The daily caps count only the reads that answered,
  since one that failed is let go so its member can ask again, so this is what bounds a file Claude
  refuses each time from being asked about again and again.

  Keyed by the verified caller, as `billReceiptUploadRateLimitMiddleware` is and for the same reasons,
  and counted in the instance's memory the same way
*/
const billReceiptReaderRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many receipts asked to be read, try again later')
  },
})

export default billReceiptReaderRateLimitMiddleware
