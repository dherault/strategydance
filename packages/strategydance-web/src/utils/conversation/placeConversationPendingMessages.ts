import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

import type { ConversationPendingMessage } from '~data/conversationComposerDrafts'

/*
  Where the messages the reader sent stand against the thread it holds: those to draw at its foot,
  which it does not hold yet, and those it no longer needs, which it holds with their bodies or which
  lie below the oldest entry it holds. A message stored takes the position the conversation was at
  when it was sent, or one after it, so once the thread holds nothing that old the message lies in
  the history above, where it is read with its body as the reader scrolls up to it, as when a long
  run has pushed it out of the tail while the thread was not drawn
*/
function placeConversationPendingMessages(
  pendingMessages: readonly ConversationPendingMessage[],
  // Oldest first
  entries: readonly Pick<ConversationThreadEntry, 'id' | 'position'>[],
  bodies: ReadonlyMap<string, Pick<ConversationMessageBody, 'id'>>,
) {
  const heldIds = new Set(entries.map(({ id }) => id))
  const oldestPosition = entries[0]?.position ?? -Infinity

  return {
    shown: pendingMessages.filter(({ id, position }) => !heldIds.has(id) && position >= oldestPosition),
    needless: pendingMessages.filter(
      ({ id, position }) => bodies.has(id) || (!heldIds.has(id) && position < oldestPosition),
    ),
  }
}

export default placeConversationPendingMessages
