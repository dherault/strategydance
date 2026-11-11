import createRateLimit from '~middleware/createRateLimit'

/*
  Adding, changing and retrying an organization's MCP servers, metered: 30 per caller in 10 minutes,
  which an administrator setting servers up stays under, since each reaches an address they typed
  and keeps this server from being anybody's way of making requests.

  Keyed by the verified caller, as `linkPreviewRateLimitMiddleware` is, and counted in the instance's
  memory the same way
*/
const integrationRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  key: 'viewer',
  message: 'Too many servers reached, try again later',
})

export default integrationRateLimitMiddleware
