import type { ConversationTail, ConversationThreadState } from '~types'

import isSameConversationThread from '~utils/conversation/isSameConversationThread'
import replaceConversationThreadRange from '~utils/conversation/replaceConversationThreadRange'
import settleConversationThread from '~utils/conversation/settleConversationThread'
import toConversationThreadEntry from '~utils/conversation/toConversationThreadEntry'

/*
  Merges a conversation's live tail, its latest messages, into what its page holds of the thread,
  or starts the thread from the first one.

  The tail is all there is from its oldest position on, and everything there is when it holds fewer
  messages than it may, so it replaces what the page held in that range: an entry it leaves out
  was deleted. Below it, what the page held stays, as history:

  - When the tail reaches back to the newest entry held, the two meet, and an entry that slid out
    of the tail stays held. Positions have holes, since Retry and Resume delete messages, so they
    meet only when they overlap, never because one position follows another
  - When it does not, after a long disconnect, messages may sit between the two: pages are read
    down to the newest entry held, and the range below it is current again once they meet
  - When `historyRevision` moved, another tab's Retry deleted messages, maybe below the tail: every
    entry held below it is read again, and whatever the pages do not return goes, a run longer than
    the tail included

  A tail older than what the page holds is ignored: the SDK hands a query's subscribers its cached
  result when they subscribe, and every result a read of the same query brings, and the revision
  and the counter both only grow
*/
function mergeConversationTail(
  state: ConversationThreadState | null,
  tail: ConversationTail,
  tailLength: number,
): ConversationThreadState {
  if (
    state
    && (tail.historyRevision < state.revision
      || (tail.historyRevision === state.revision && tail.nextMessagePosition < state.counter))
  ) {
    return state
  }

  const batch = tail.messages.map(toConversationThreadEntry).reverse()
  const isWhole = batch.length < tailLength
  const from = isWhole ? -Infinity : batch[0]!.position
  const held = state?.entries ?? []
  const entries = replaceConversationThreadRange(held, from, Infinity, batch)
  const base = { revision: tail.historyRevision, counter: tail.nextMessagePosition, entries }

  if (!state || isWhole || held.length === 0) {
    return { ...base, verifiedFrom: from, fillTo: null, resume: null, hasOlder: !isWhole }
  }

  if (tail.historyRevision !== state.revision) {
    const lowest = entries[0]!.position

    return { ...base, verifiedFrom: from, fillTo: lowest < from ? lowest : null, resume: null, hasOlder: true }
  }

  const newest = held.at(-1)!.position
  const next: ConversationThreadState =
    from <= newest
      ? settleConversationThread({ ...state, ...base, verifiedFrom: Math.min(state.verifiedFrom, from) })
      : {
          ...base,
          verifiedFrom: from,
          fillTo: state.fillTo === null ? newest : Math.min(state.fillTo, newest),
          resume: state.resume ?? { verifiedFrom: state.verifiedFrom, hasOlder: state.hasOlder },
          hasOlder: true,
        }

  return isSameConversationThread(state, next) ? state : next
}

export default mergeConversationTail
