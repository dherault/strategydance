import type { ConversationPage, ConversationThreadState } from '~types'

import replaceConversationThreadRange from '~utils/conversation/replaceConversationThreadRange'
import settleConversationThread from '~utils/conversation/settleConversationThread'
import toConversationThreadEntry from '~utils/conversation/toConversationThreadEntry'

/*
  Merges a history page, the messages read below a position, into what a conversation's page holds
  of its thread. The page is all there is from its oldest position up to where it was read, and
  everything below that when it holds fewer messages than it may, so it replaces what was held in
  that range, and the verified range now starts where it does.

  Only a page read below where the verified range starts now, in the history the thread holds, is
  merged. Anything else was overtaken while it was read: by another page, or by a tail that moved
  the revision, whose own reads replace it
*/
function mergeConversationPage(
  state: ConversationThreadState,
  page: ConversationPage,
  pageLength: number,
): ConversationThreadState {
  if (page.before !== state.verifiedFrom || page.historyRevision !== state.revision) return state

  const batch = page.messages.map(toConversationThreadEntry).reverse()
  const isFull = batch.length >= pageLength
  const from = isFull ? batch[0]!.position : -Infinity

  return settleConversationThread({
    ...state,
    entries: replaceConversationThreadRange(state.entries, from, page.before, batch),
    verifiedFrom: from,
    hasOlder: isFull,
  })
}

export default mergeConversationPage
