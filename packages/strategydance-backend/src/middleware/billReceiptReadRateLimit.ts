import createRateLimit from '~middleware/createRateLimit'

/*
  The reads of bills' receipts, metered: 600 per caller in 10 minutes, as many as a conversation's
  files take, which a member opening receipt after receipt stays under and a script copying the
  bucket out does not.

  Keyed by the verified caller, as `billReceiptUploadRateLimitMiddleware` is, and counted in the
  instance's memory the same way
*/
const billReceiptReadRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 600,
  key: 'viewer',
  message: 'Too many receipts read, try again later',
})

export default billReceiptReadRateLimitMiddleware
