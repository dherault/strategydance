import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_BAD_REQUEST, ERROR_CODE_INTERNAL_ERROR } from 'strategydance-core'

import logger from '~utils/logger'
import parseClientErrorStatus from '~utils/parseClientErrorStatus'
import respondError from '~utils/respondError'

/*
  The last resort for anything a route threw. An error the caller caused, like a body that is not
  JSON, is answered with its own 4xx and message; anything else is logged and answered with a
  500 that says nothing about why.

  Four parameters, because that is how Express tells an error middleware from any other
*/
function errorMiddleware(error: unknown, request: Request, response: Response, next: NextFunction) {
  if (response.headersSent) {
    next(error)

    return
  }

  const clientErrorStatus = parseClientErrorStatus(error)

  if (clientErrorStatus) {
    respondError(response, clientErrorStatus, ERROR_CODE_BAD_REQUEST, error instanceof Error ? error.message : 'Bad request')

    return
  }

  logger.error(`${request.method} ${request.originalUrl} failed`, error)

  respondError(response, 500, ERROR_CODE_INTERNAL_ERROR, 'Internal server error')
}

export default errorMiddleware
