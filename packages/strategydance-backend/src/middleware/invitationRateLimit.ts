import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import respondError from '~utils/respondError'

/*
  Every address in an invite request is an email this server sends, so the route is metered: 20
  requests per caller in 10 minutes, which a person inviting their team never reaches and a
  script mailing strangers does.

  Keyed by the verified caller rather than the address, since one office shares an address and
  one caller can hold many. It runs after `authenticationMiddleware`, and falls back to the
  address only if it ever does not.

  Counted in the instance's memory, so a caller spread across several Cloud Run instances gets
  that many allowances. A shared store is the fix once that matters
*/
const invitationRateLimitMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: request => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many invitations sent, try again later')
  },
})

export default invitationRateLimitMiddleware
