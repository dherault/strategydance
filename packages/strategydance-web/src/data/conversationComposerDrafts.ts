import type { ConversationSendFailure } from '~utils/conversation/getConversationSendFailure'
import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

/*
  The message the reader is writing to a conversation, and where its sending stands: what a
  composer holds that outlives the composer
*/
export type ConversationComposerDraft = {
  text: string
  // The documents its mentions name, by their titles
  mentions: ReadonlyMap<string, string>
  // The id of the message a send is taking, while it goes, which no other send may race
  sendingMessageId: string | null
  // The send that failed, kept so that sending the same message again is the same send: its id,
  // and the message as it was sent, its mentions links to their documents
  failedSend: { messageId: string; text: string } | null
  // Why the last send failed, until the reader writes again
  failure: ConversationSendFailure | null
  // The run the reader last started, by a send, a resume, a retry or an answer, which counts as
  // going before the live read of the latest run shows it, wherever the conversation is drawn
  startedRun: StartedConversationRun | null
}

export const EMPTY_CONVERSATION_COMPOSER_DRAFT: ConversationComposerDraft = {
  text: '',
  mentions: new Map(),
  sendingMessageId: null,
  failedSend: null,
  failure: null,
  startedRun: null,
}

const drafts = new Map<string, ConversationComposerDraft>()
const listeners = new Set<() => void>()

function isEmpty(draft: ConversationComposerDraft) {
  return (
    !draft.text
    && !draft.mentions.size
    && !draft.sendingMessageId
    && !draft.failedSend
    && !draft.failure
    && !draft.startedRun
  )
}

/*
  Each conversation's message being written, kept for the life of the tab and shared by every
  composer that draws the conversation: its page and its dock's window, a window minimized and
  opened again, or one the "+N" menu held, all show the same words and the same send. A send that
  lands after its composer has gone, the conversation drawn elsewhere meanwhile, settles there, and
  a send going in one is going in all. Never stored: a reload starts afresh, as the page always has.

  Kept by `${userId}:${conversationId}`, which `useConversationComposerDraft` makes, since the tab
  outlives a sign-out: one account never finds another's message
*/
export function readConversationComposerDraft(key: string) {
  return drafts.get(key) ?? EMPTY_CONVERSATION_COMPOSER_DRAFT
}

// Changes what a conversation's composers hold, and forgets it once there is nothing left
export function updateConversationComposerDraft(
  key: string,
  update: (current: ConversationComposerDraft) => ConversationComposerDraft,
) {
  const current = readConversationComposerDraft(key)
  const next = update(current)

  if (next === current) return

  if (!isEmpty(next)) drafts.set(key, next)
  else if (drafts.has(key)) drafts.delete(key)
  else return

  for (const listener of listeners) listener()
}

export function subscribeToConversationComposerDrafts(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
