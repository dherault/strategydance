import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import respondOAuthError from '~utils/respondOAuthError'

/*
  Registrations, metered: 20 per address in an hour, which a developer trying a client never
  reaches and a script does. Nobody is signed in to register, so the address is all there is to key
  on. Counted in the instance's memory, as the backend's other limits are; the database holds every
  registration to a cap in all, across instances
*/
const oauthRegistrationRateLimitMiddleware = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondOAuthError(response, 429, 'too_many_requests', 'Too many registrations from this address, try again later')
  },
})

export default oauthRegistrationRateLimitMiddleware
