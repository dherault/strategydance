import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_EMAIL_NOT_VERIFIED } from 'strategydance-core'

import { IS_EMAIL_VERIFICATION_REQUIRED } from '~constants'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

/*
  Lets through a caller whose ID token says their address is confirmed, on the conversations'
  routes that start or continue a run: the send, an answer, an approval, Resume, Retry, and a file's
  upload, which only a send uses. An account costs nothing to make, and a password sign-up can name
  any address nobody has claimed, so the daily caps' allowance is tied to an address its owner
  confirmed. A run already started goes on, and the routes that stop, reconcile or read refuse
  nobody for it.

  It runs after `authenticationMiddleware` and reads the token alone, never the account: a member
  who just confirmed their address mints a new token first, as the page does once they say so. The
  development backend lets everybody through (`IS_EMAIL_VERIFICATION_REQUIRED`), since its Auth
  emulator confirms nothing by itself
*/
function verifiedEmailMiddleware(request: Request, response: Response, next: NextFunction) {
  if (IS_EMAIL_VERIFICATION_REQUIRED && !readViewer(request).isEmailVerified) {
    respondError(
      response,
      403,
      ERROR_CODE_EMAIL_NOT_VERIFIED,
      'Confirm your address to start or continue a conversation',
    )

    return
  }

  next()
}

export default verifiedEmailMiddleware
