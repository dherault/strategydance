import createRateLimit from '~middleware/createRateLimit'

/*
  The uploads of files to conversations, metered: 120 per caller in 10 minutes, which a member
  attaching, removing and attaching again a tray's worth of files stays under and a script filling
  the bucket does not. Their quota of 30 unsent files bounds what is kept; this bounds the bytes
  carried.

  Keyed by the verified caller, as `richTextImageRateLimitMiddleware` is and for the same reasons,
  and counted in the instance's memory the same way
*/
const conversationAttachmentUploadRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  key: 'viewer',
  message: 'Too many files uploaded, try again later',
})

export default conversationAttachmentUploadRateLimitMiddleware
