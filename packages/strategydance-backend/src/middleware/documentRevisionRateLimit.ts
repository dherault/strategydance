import { DOCUMENT_REVISION_RATE_LIMIT, DOCUMENT_REVISION_RATE_WINDOW_MS } from '~constants'

import createRateLimit from '~middleware/createRateLimit'

/*
  A member's reads of what their conversations' edits can undo and their restores of documents'
  revisions, metered together: 60 per caller in 10 minutes, which a thread refetching on focus and
  a member going back through a history stay under, while each one merges a whole document's text
  in the instance.

  Keyed by the verified caller, as `richTextImageRateLimitMiddleware` is and for the same reasons,
  and counted in the instance's memory the same way
*/
const documentRevisionRateLimitMiddleware = createRateLimit({
  windowMs: DOCUMENT_REVISION_RATE_WINDOW_MS,
  limit: DOCUMENT_REVISION_RATE_LIMIT,
  key: 'viewer',
  message: 'Too many versions read or restored, try again later',
})

export default documentRevisionRateLimitMiddleware
