import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import respondError from '~utils/respondError'

/*
  The invite route's requests, metered: 20 per caller in 10 minutes, which a person inviting their
  team never reaches and a script does. The invitations they create, which are the emails this
  server sends, are metered on their own, in the database, by `createOrganizationInvitations`.

  Keyed by the verified caller rather than the address, since one office shares an address and
  one caller can hold many. It runs after `authenticationMiddleware`, and falls back to the
  address only if it ever does not.

  Counted in the instance's memory, so a caller spread across several Cloud Run instances gets
  that many allowances. That bounds requests rather than mail, which the database count holds to
  across instances, so a shared store here waits until request volume itself matters
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
