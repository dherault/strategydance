import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_UNAUTHORIZED_AUTHENTICATION } from 'strategydance-core'

import { authentication } from '~firebase'

import logger from '~utils/logger'
import parseBearerToken from '~utils/parseBearerToken'
import respondError from '~utils/respondError'

/*
  Who is calling, from the Firebase ID token in the `Authorization` header. A token that fails
  verification is usually one that expired between the browser reading it and this server
  checking it, so the answer is the same 401 either way and the client asks again
*/
async function authenticationMiddleware(request: Request, response: Response, next: NextFunction) {
  const idToken = parseBearerToken(request.header('Authorization'))

  if (!idToken) {
    respondError(response, 401, ERROR_CODE_UNAUTHORIZED_AUTHENTICATION, 'No token provided')

    return
  }

  try {
    const { uid, email } = await authentication.verifyIdToken(idToken)

    request.viewer = {
      id: uid,
      email: email ?? null,
    }
  }
  catch (error) {
    logger.warn('Authentication: the ID token failed verification', error)

    respondError(response, 401, ERROR_CODE_UNAUTHORIZED_AUTHENTICATION, 'Invalid token')

    return
  }

  next()
}

export default authenticationMiddleware
