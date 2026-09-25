import type { NextFunction, Request, Response } from 'express'

import { IS_PRODUCTION } from '~constants'

import logger from '~utils/logger'

// Each request and its status, in development only: Cloud Run logs every request itself
function loggerMiddleware(request: Request, response: Response, next: NextFunction) {
  if (IS_PRODUCTION) {
    next()

    return
  }

  const requestString = `${request.method} ${request.originalUrl}`

  logger.info(`→ ${requestString}`)

  response.on('finish', () => {
    logger.info(`← ${requestString} ${response.statusCode}`)
  })

  next()
}

export default loggerMiddleware
