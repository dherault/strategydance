import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  Adding, changing and retrying an organization's MCP servers, metered: 30 per caller in 10 minutes,
  which an administrator setting servers up stays under, since each reaches an address they typed
  and keeps this server from being anybody's way of making requests.

  Keyed by the verified caller, as `linkPreviewRateLimitMiddleware` is, and counted in the instance's
  memory the same way
*/
const integrationRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many servers reached, try again later')
  },
})

export default integrationRateLimitMiddleware
