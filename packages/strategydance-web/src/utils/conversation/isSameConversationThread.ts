import type { ConversationThreadState } from '~types'

// Whether a merge changed nothing, so the thread keeps its state and nothing is drawn again
function isSameConversationThread(a: ConversationThreadState, b: ConversationThreadState) {
  return (
    a.entries === b.entries
    && a.revision === b.revision
    && a.counter === b.counter
    && a.verifiedFrom === b.verifiedFrom
    && a.fillTo === b.fillTo
    && a.resume?.verifiedFrom === b.resume?.verifiedFrom
    && a.resume?.hasOlder === b.resume?.hasOlder
    && a.hasOlder === b.hasOlder
  )
}

export default isSameConversationThread
