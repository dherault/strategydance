import { ApiError } from '~data/api'

// When a refused send, resume or retry can go again, from its `Retry-After`, as a time in
// milliseconds, so what the page says of it moves on as the reader waits: null when it says nothing
function getConversationFailureRetryAt(error: unknown, now = Date.now()) {
  return error instanceof ApiError && error.retryAfterMs !== null ? now + error.retryAfterMs : null
}

export default getConversationFailureRetryAt
