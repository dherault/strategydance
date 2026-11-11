import createRateLimit from '~middleware/createRateLimit'

/*
  The link previews read, metered: 60 per caller in 10 minutes, which a document pasted full of
  links stays under, and which keeps this server from being anybody's way of fetching pages.

  Keyed by the verified caller, as `organizationImageRateLimitMiddleware` is and for the same
  reasons, and counted in the instance's memory the same way
*/
const linkPreviewRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  key: 'viewer',
  message: 'Too many links previewed, try again later',
})

export default linkPreviewRateLimitMiddleware
