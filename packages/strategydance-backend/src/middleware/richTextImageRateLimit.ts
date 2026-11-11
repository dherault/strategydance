import createRateLimit from '~middleware/createRateLimit'

/*
  The uploads of pictures for documents' text, metered: 60 per caller in 10 minutes, which a page
  of screenshots pasted one after the other stays under and a script filling the bucket does not.

  Keyed by the verified caller, as `organizationImageRateLimitMiddleware` is and for the same
  reasons, and counted in the instance's memory the same way
*/
const richTextImageRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  key: 'viewer',
  message: 'Too many pictures uploaded, try again later',
})

export default richTextImageRateLimitMiddleware
