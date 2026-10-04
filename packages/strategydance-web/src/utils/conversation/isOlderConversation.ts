import type { Conversation } from '~types'

/*
  Whether a read of a conversation is older than another: its history behind, its counter behind,
  or, at the same two, its thread reaching past the other's newest message, which was deleted since,
  as Resume deletes its note. Nothing is inserted without moving the counter, and only Retry moves
  the history. A conversation gone is never older: deleting it, or losing access to it, reads so
*/
function isOlderConversation(current: Conversation | undefined, next: Conversation | undefined) {
  if (!current || !next) return false
  if (next.historyRevision !== current.historyRevision) return next.historyRevision < current.historyRevision
  if (next.nextMessagePosition !== current.nextMessagePosition) {
    return next.nextMessagePosition < current.nextMessagePosition
  }

  const nextNewest = next.conversationMessages_on_conversation[0]?.position ?? -Infinity
  const currentNewest = current.conversationMessages_on_conversation[0]?.position ?? -Infinity

  return nextNewest > currentNewest
}

export default isOlderConversation
