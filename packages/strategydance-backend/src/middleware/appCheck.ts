import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_UNAUTHORIZED_APP_CHECK, HEADER_APP_CHECK_TOKEN } from 'strategydance-core'

import { IS_DEVELOPMENT } from '~constants'

import { appCheck } from '~firebase'

import logger from '~utils/logger'
import respondError from '~utils/respondError'

/*
  Attests that the caller is a real build of the app rather than a script holding somebody's
  token, which is a different question from the one `authenticationMiddleware` answers, and a
  route asks both.

  Skipped in development. The emulators do not enforce App Check either, and the debug token a
  development browser holds can only be verified by the real project, so checking it locally
  would refuse every call
*/
async function appCheckMiddleware(request: Request, response: Response, next: NextFunction) {
  if (IS_DEVELOPMENT) {
    next()

    return
  }

  const appCheckToken = request.header(HEADER_APP_CHECK_TOKEN)

  if (!appCheckToken) {
    respondError(response, 401, ERROR_CODE_UNAUTHORIZED_APP_CHECK, 'No App Check token provided')

    return
  }

  try {
    await appCheck.verifyToken(appCheckToken)
  }
  catch (error) {
    logger.warn('App Check: the token failed verification', error)

    respondError(response, 401, ERROR_CODE_UNAUTHORIZED_APP_CHECK, 'Invalid App Check token')

    return
  }

  next()
}

export default appCheckMiddleware
