import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_BAD_REQUEST } from 'strategydance-core'
import { type ZodType, prettifyError } from 'zod'

import respondError from '~utils/respondError'

type Schemas = {
  params?: ZodType
  body?: ZodType
}

/*
  Refuses a request whose route parameters or body do not match their schemas, and hands the
  route the parsed body rather than the raw one, so whatever a schema normalizes, like an address
  lowercased, is what the route reads
*/
function validateMiddleware({ params: paramsSchema, body: bodySchema }: Schemas) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (paramsSchema) {
      const params = paramsSchema.safeParse(request.params)

      if (!params.success) {
        respondError(response, 400, ERROR_CODE_BAD_REQUEST, prettifyError(params.error))

        return
      }
    }

    if (bodySchema) {
      const body = bodySchema.safeParse(request.body)

      if (!body.success) {
        respondError(response, 400, ERROR_CODE_BAD_REQUEST, prettifyError(body.error))

        return
      }

      request.body = body.data
    }

    next()
  }
}

export default validateMiddleware
