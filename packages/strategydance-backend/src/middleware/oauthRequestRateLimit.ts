import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  The consent page's reads and decisions, metered: 60 per caller in 10 minutes, as link previews
  are, since reading a request is what makes the server fetch a client's document, and keeps this
  server from being anybody's way of fetching addresses. Keyed by the verified caller, and counted in
  the instance's memory, as the backend's other limits are
*/
const oauthRequestRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many authorization requests read, try again later')
  },
})

export default oauthRequestRateLimitMiddleware
