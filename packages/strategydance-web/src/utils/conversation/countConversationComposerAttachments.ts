import type { ConversationComposerDraft } from '~data/conversationComposerDrafts'

/*
  How many files the reader's message holds against what a message may: those in the tray, and those
  of the message whose send is going, which a failed send puts back beside them
*/
function countConversationComposerAttachments({
  attachments,
  sendingMessageId,
  pendingMessages,
}: Pick<ConversationComposerDraft, 'attachments' | 'sendingMessageId' | 'pendingMessages'>) {
  const sending = pendingMessages.find(({ id }) => id === sendingMessageId)

  return attachments.length + (sending?.attachments.length ?? 0)
}

export default countConversationComposerAttachments
