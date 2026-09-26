import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import respondError from '~utils/respondError'

/*
  The organization picture routes' requests, metered: 30 per caller in 10 minutes, uploads and
  removals together, which somebody trying logos never reaches and a script filling the bucket
  does.

  Keyed by the verified caller, as `invitationRateLimitMiddleware` is and for the same reasons, and
  counted in the instance's memory the same way
*/
const organizationImageRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many pictures changed, try again later')
  },
})

export default organizationImageRateLimitMiddleware
