import createRateLimit from '~middleware/createRateLimit'

/*
  The removals of unsent files from conversations' drafts, metered apart from the uploads, so
  removing what one uploaded never takes from what one may upload: 120 per caller in 10 minutes,
  keyed and counted as `conversationAttachmentUploadRateLimitMiddleware` is
*/
const conversationAttachmentRemovalRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  key: 'viewer',
  message: 'Too many files removed, try again later',
})

export default conversationAttachmentRemovalRateLimitMiddleware
