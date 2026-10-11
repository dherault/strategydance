import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import respondOAuthError from '~utils/respondOAuthError'

/*
  The revocation endpoint, metered: 300 requests per address in ten minutes, before the form is
  read, since a token it does not know still costs a read. Generous for the same reason as the token
  endpoint's: a hosted client revokes from its own servers. Counted in the instance's memory
*/
const oauthRevocationRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondOAuthError(response, 429, 'too_many_requests', 'Too many revocations from this address, try again later')
  },
})

export default oauthRevocationRateLimitMiddleware
