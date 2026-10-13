import type { NextFunction, Request, Response } from 'express'

import { IS_PRODUCTION } from '~constants'

import logger from '~utils/logger'

// The paths whose query holds a secret, which is never logged: the callback of members' Connects,
// whose code and state an authorization server sends in it
const SECRET_QUERY_PATHS = ['/integrations/oauth/callback']

// Each request and its status, in development only: Cloud Run logs every request itself
function loggerMiddleware(request: Request, response: Response, next: NextFunction) {
  if (IS_PRODUCTION) {
    next()

    return
  }

  const isQuerySecret = SECRET_QUERY_PATHS.includes(request.path.toLowerCase())
  const requestString = `${request.method} ${isQuerySecret ? request.path : request.originalUrl}`

  logger.info(`→ ${requestString}`)

  response.on('finish', () => {
    logger.info(`← ${requestString} ${response.statusCode}`)
  })

  next()
}

export default loggerMiddleware
