import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import renderAuthorizationErrorPage from '~domain/oauth/renderAuthorizationErrorPage'

/*
  Authorizations, metered: 60 per address in ten minutes, since each stores a request before
  anybody has signed in. Answered as a page, since a browser makes the request and its client is
  not known good yet. Counted in the instance's memory; the database holds every request to a
  ceiling in all, across instances
*/
const oauthAuthorizationRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    response
      .status(429)
      .type('html')
      .send(renderAuthorizationErrorPage('Too many authorizations from this address. Try again in a few minutes.'))
  },
})

export default oauthAuthorizationRateLimitMiddleware
