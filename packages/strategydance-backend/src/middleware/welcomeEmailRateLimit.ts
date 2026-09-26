import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import respondError from '~utils/respondError'

/*
  The welcome email route's requests, metered: 10 per caller in 10 minutes. The web app asks once
  a visit, and only while the account's welcome has not gone out, so a person never comes near it
  and a script calling in a loop does. The lease already keeps a repeat from mailing; this keeps it
  from costing a token verification and a database write each time.

  Keyed by the verified caller, and counted in the instance's memory like the invite route's: it
  bounds load rather than mail, which the lease holds to one
*/
const welcomeEmailRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many requests for the welcome email, try again later')
  },
})

export default welcomeEmailRateLimitMiddleware
