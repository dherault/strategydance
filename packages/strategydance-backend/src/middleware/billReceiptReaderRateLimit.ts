import createRateLimit from '~middleware/createRateLimit'

/*
  The receipt reader's asks, metered: 30 per caller in 10 minutes, which a member uploading a month
  of invoices one after the other stays under. The daily caps count only the reads that answered,
  since one that failed is let go so its member can ask again, so this is what bounds a file Claude
  refuses each time from being asked about again and again.

  Keyed by the verified caller, as `billReceiptUploadRateLimitMiddleware` is and for the same reasons,
  and counted in the instance's memory the same way
*/
const billReceiptReaderRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  key: 'viewer',
  message: 'Too many receipts asked to be read, try again later',
})

export default billReceiptReaderRateLimitMiddleware
