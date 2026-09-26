import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import type { QuotaWindow } from '~utils/debitQuota'
import debitQuota from '~utils/debitQuota'
import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

// Addresses one caller may invite in a window. Twice what fills a team, which only somebody
// sending to strangers needs more of
const RECIPIENT_LIMIT = 200

const WINDOW_MS = 60 * 60 * 1000

const windows = new Map<string, QuotaWindow>()

/*
  Every address in an invite request is an email this server sends, so each one is debited from
  its caller's allowance, rather than the request carrying them: 200 addresses an hour, whether
  they come one at a time or fifty to a request. `invitationRateLimitMiddleware` still meters the
  requests themselves.

  Runs after `validateMiddleware`, which normalizes and deduplicates the addresses, so the same
  one typed twice costs once. Addresses are debited when asked for rather than when sent, so a
  request refused later still counts: the invite form refuses what would be, and a person using
  it never comes near the limit.

  Counted in this instance's memory, like the request limit: a caller spread over several Cloud
  Run instances gets an allowance on each. A quota that holds across instances needs a shared
  store, which belongs with the email provider that actually sends, when Resend is wired
*/
function invitationRecipientQuotaMiddleware(request: Request, response: Response, next: NextFunction) {
  const { emails } = request.body as { emails: string[] }

  const { allowed, retryAfterMs } = debitQuota({
    windows,
    key: readViewer(request).id,
    amount: emails.length,
    limit: RECIPIENT_LIMIT,
    windowMs: WINDOW_MS,
    now: Date.now(),
  })

  if (!allowed) {
    response.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000))
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many invitations sent, try again later')

    return
  }

  next()
}

export default invitationRecipientQuotaMiddleware
