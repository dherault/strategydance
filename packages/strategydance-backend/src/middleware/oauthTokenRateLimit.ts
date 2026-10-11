import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import respondOAuthError from '~utils/respondOAuthError'

/*
  The token endpoint, metered: 600 requests per address in ten minutes, before the form is read, so
  nobody turns guessed codes or tokens into unbounded reads of the database. Generous, since a hosted
  client, claude.ai or ChatGPT, exchanges and refreshes every member's tokens from its own servers,
  a few addresses for all of them: revisit it with the launch. Counted in the instance's memory, as
  the backend's other limits are
*/
const oauthTokenRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondOAuthError(response, 429, 'too_many_requests', 'Too many token requests from this address, try again later')
  },
})

export default oauthTokenRateLimitMiddleware
