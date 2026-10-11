// What the reader wrote in a conversation's composer and has not sent: the words, and the
// documents its mentions name by their titles
export type ConversationComposerDraft = {
  text: string
  mentions: ReadonlyMap<string, string>
}

const drafts = new Map<string, ConversationComposerDraft>()

/*
  The words written to each conversation and not sent, kept for the life of the tab, so a
  conversation drawn again elsewhere starts with them: its page and its dock's window, a window
  minimized and opened again, or one the "+N" menu held. Never stored: a reload starts afresh, as
  the page always has
*/
export function readConversationComposerDraft(conversationId: string) {
  return drafts.get(conversationId) ?? null
}

// Keeps what a composer holds, or forgets it once there is nothing left to send
export function writeConversationComposerDraft(conversationId: string, draft: ConversationComposerDraft | null) {
  if (draft?.text) drafts.set(conversationId, draft)
  else drafts.delete(conversationId)
}
