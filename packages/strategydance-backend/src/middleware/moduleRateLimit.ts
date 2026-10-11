import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import { MAX_MODULE_REQUESTS, MODULE_REQUEST_WINDOW_MS } from '~constants'

import respondJsonRpcError from '~utils/respondJsonRpcError'

import readModuleCaller from '~modules/readModuleCaller'

/*
  A module's endpoint, metered per connection, once its token is verified and before its body is
  read: 600 calls in ten minutes, counted in the instance's memory, as the backend's other limits
  are. Keyed by the connection, which the caller's idempotency scope names, so one agent's loop
  slows itself alone, and a hosted client calling for many members from one address is not counted
  as one. The bearer check runs before it, so every request it counts carries its caller; the
  address only stands in should it ever run without one
*/
const moduleRateLimitMiddleware = rateLimit({
  windowMs: MODULE_REQUEST_WINDOW_MS,
  limit: MAX_MODULE_REQUESTS,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  identifier: 'per-connection',
  keyGenerator: request =>
    request.auth ? readModuleCaller(request.auth).idempotencyScope : ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondJsonRpcError(response, 429, -32000, 'Too many calls through this connection, try again in a few minutes')
  },
})

export default moduleRateLimitMiddleware
