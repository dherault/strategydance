import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import { MAX_REFUSED_MODULE_REQUESTS, MODULE_REQUEST_WINDOW_MS } from '~constants'

import respondJsonRpcError from '~utils/respondJsonRpcError'

/*
  A module's endpoint, metered per address before its token is read, so a caller presenting tokens
  it made up, or calling on once its connection used its calls up, costs a bounded number of reads
  of the database: 600 refused calls in ten minutes, counted in the instance's memory, as the
  backend's other limits are. Only a refused call counts, an answer under 400 taken back once it
  is sent, so a hosted client calling for many members from a few addresses of its own is held by
  each connection's limit alone
*/
const moduleAddressRateLimitMiddleware = rateLimit({
  windowMs: MODULE_REQUEST_WINDOW_MS,
  limit: MAX_REFUSED_MODULE_REQUESTS,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  identifier: 'refused-per-address',
  requestPropertyName: 'moduleAddressRateLimit',
  keyGenerator: request => ipKeyGenerator(request.ip ?? ''),
  handler: (_request, response) => {
    respondJsonRpcError(response, 429, -32000, 'Too many refused calls from this address, try again in a few minutes')
  },
})

export default moduleAddressRateLimitMiddleware
