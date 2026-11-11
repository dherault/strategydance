import createRateLimit from '~middleware/createRateLimit'

/*
  The uploads of bills' receipts, metered: 60 per caller in 10 minutes, which a member entering a
  month of invoices one after the other stays under and a script filling the bucket does not.

  Keyed by the verified caller, as `richTextImageRateLimitMiddleware` is and for the same reasons,
  and counted in the instance's memory the same way
*/
const billReceiptUploadRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  key: 'viewer',
  message: 'Too many receipts uploaded, try again later',
})

export default billReceiptUploadRateLimitMiddleware
