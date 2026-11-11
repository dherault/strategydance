import type { Request, Response } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { ERROR_CODE_TOO_MANY_REQUESTS } from 'strategydance-core'

import respondError from '~utils/respondError'

type RateLimitOptions = {
  windowMs: number
  limit: number
  /*
    Whose requests are counted together: the verified caller's, since one office shares an address
    and one caller can hold many, falling back to the address should the limit ever run before
    `authenticationMiddleware`, or the address's alone, where nobody has signed in yet
  */
  key: 'viewer' | 'address'
}
  // What a request past the limit is answered, in the app's envelope
  & (
    | { message: string }
    // Or how, where the caller is a browser or speaks a protocol of its own
    | { handler: (request: Request, response: Response) => void }
  )

const KEY_GENERATORS = {
  viewer: (request: Request) => request.viewer?.id ?? ipKeyGenerator(request.ip ?? ''),
  address: (request: Request) => ipKeyGenerator(request.ip ?? ''),
}

/*
  A route's requests metered: so many in a window, counted in the instance's memory, so a caller
  spread across several Cloud Run instances gets that many allowances, with the standard headers
  saying where the count stands. Each limit says why it is what it is where it is made
*/
function createRateLimit(options: RateLimitOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: KEY_GENERATORS[options.key],
    handler: 'handler' in options ? options.handler : toRefusal(options.message),
  })
}

function toRefusal(message: string) {
  return (_request: Request, response: Response) => {
    respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, message)
  }
}

export default createRateLimit
