import type { ConversationComposerDraft } from '~data/conversationComposerDrafts'

// What a message holds in the composer: its words, the documents they mention and its files
type ConversationComposerMessage = Pick<ConversationComposerDraft, 'text' | 'mentions' | 'attachments'>

/*
  The message a send took out of the field, put back in it once the send failed, so the reader can
  send it again: as it was sent when nothing was written meanwhile, so sending it again is the same
  send, or else ahead of what was, on a line of its own, with the mentions and the files of both, a
  mention picked since winning where two share a title, as the last pick does
*/
function restoreConversationFailedSend(
  sent: ConversationComposerMessage,
  current: ConversationComposerMessage,
): ConversationComposerMessage {
  return {
    text: [sent.text, current.text].filter(Boolean).join('\n'),
    mentions: current.mentions.size ? new Map([...sent.mentions, ...current.mentions]) : sent.mentions,
    attachments: [...sent.attachments, ...current.attachments],
  }
}

export default restoreConversationFailedSend
