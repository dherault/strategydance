// What the reader wrote in a conversation's composer and has not sent: the words, and the
// documents its mentions name by their titles
export type ConversationComposerDraft = {
  text: string
  mentions: ReadonlyMap<string, string>
}

const drafts = new Map<string, ConversationComposerDraft>()
const listeners = new Set<() => void>()

/*
  The words written to each conversation and not sent, kept for the life of the tab and shared by
  every composer that draws the conversation: its page and its dock's window, a window minimized
  and opened again, or one the "+N" menu held, all start with them. A send that lands after its
  composer has gone, the conversation drawn elsewhere meanwhile, still clears them there. Never
  stored: a reload starts afresh, as the page always has
*/
export function readConversationComposerDraft(conversationId: string) {
  return drafts.get(conversationId) ?? null
}

// Changes what a conversation's composers hold, or forgets it once there is nothing left to send
export function updateConversationComposerDraft(
  conversationId: string,
  update: (current: ConversationComposerDraft | null) => ConversationComposerDraft | null,
) {
  const current = drafts.get(conversationId) ?? null
  const next = update(current)

  if (next === current) return

  if (next?.text) drafts.set(conversationId, next)
  else if (current) drafts.delete(conversationId)
  else return

  for (const listener of listeners) listener()
}

export function subscribeToConversationComposerDrafts(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
