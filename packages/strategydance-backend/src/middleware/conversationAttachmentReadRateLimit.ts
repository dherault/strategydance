import createRateLimit from '~middleware/createRateLimit'

/*
  The reads of conversations' files, metered generously: 600 per caller in 10 minutes, since a
  thread draws a thumbnail of each of its images, up to 100 files a conversation, and a reader opens
  several. Keyed and counted as `conversationAttachmentUploadRateLimitMiddleware` is
*/
const conversationAttachmentReadRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 600,
  key: 'viewer',
  message: 'Too many files read, try again later',
})

export default conversationAttachmentReadRateLimitMiddleware
