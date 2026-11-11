import createRateLimit from '~middleware/createRateLimit'

/*
  The consent page's reads and decisions, metered: 60 per caller in 10 minutes, as link previews
  are, since reading a request is what makes the server fetch a client's document, and keeps this
  server from being anybody's way of fetching addresses. Keyed by the verified caller, and counted in
  the instance's memory, as the backend's other limits are
*/
const oauthRequestRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  key: 'viewer',
  message: 'Too many authorization requests read, try again later',
})

export default oauthRequestRateLimitMiddleware
