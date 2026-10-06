import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

/*
  The link previews read, metered: 60 per caller in 10 minutes, which a document pasted full of
  links stays under, and which keeps this server from being anybody's way of fetching pages.

  Keyed by the verified caller, as `organizationImageRateLimitMiddleware` is and for the same
  reasons, and counted in the instance's memory the same way
*/
const linkPreviewRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many links previewed, try again later')
  },
})

export default linkPreviewRateLimitMiddleware
