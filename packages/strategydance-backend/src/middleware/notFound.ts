import type { Request, Response } from 'express'
import { ERROR_CODE_NOT_FOUND } from 'strategydance-core'

import respondError from '~utils/respondError'

// Registered after every route, so it answers whatever none of them did
function notFoundMiddleware(_request: Request, response: Response) {
  respondError(response, 404, ERROR_CODE_NOT_FOUND, 'Endpoint not found')
}

export default notFoundMiddleware
