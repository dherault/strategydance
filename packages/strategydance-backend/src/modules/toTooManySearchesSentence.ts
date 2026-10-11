import { CONVERSATION_SEARCH_WINDOW_MINUTES, MAX_CONVERSATION_SEARCHES } from 'strategydance-core'

/*
  What a module's search is refused with past the member's search allowance, as the model reads it:
  the allowance, when the next search fits, and what still works meanwhile, `meanwhile` naming the
  module's own read that counts no search
*/
function toTooManySearchesSentence(retryAfterMs: number, meanwhile: string) {
  return `Searches as the member are limited to ${MAX_CONVERSATION_SEARCHES} in ${CONVERSATION_SEARCH_WINDOW_MINUTES} minutes, and they reached it. Search again in ${toWait(retryAfterMs)}, or ${meanwhile} meanwhile.`
}

// How long until the next search fits, in whole minutes
function toWait(retryAfterMs: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000))

  return minutes === 1 ? 'a minute' : `${minutes} minutes`
}

export default toTooManySearchesSentence
