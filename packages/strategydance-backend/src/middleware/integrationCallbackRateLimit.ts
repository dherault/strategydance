import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import { INTEGRATION_CONNECTED_URL } from '~constants'

/*
  The callback of members' Connects, metered: 60 per address in ten minutes, since anybody can call
  it and each call looks a state up, which a member signing in a few times never comes near. Answered
  as the page the browser goes on to, saying the sign-in failed, since a browser makes the request.
  Counted in the instance's memory
*/
const integrationCallbackRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.redirect(303, `${INTEGRATION_CONNECTED_URL}?${new URLSearchParams({ outcome: 'failed' })}`)
  },
})

export default integrationCallbackRateLimitMiddleware
