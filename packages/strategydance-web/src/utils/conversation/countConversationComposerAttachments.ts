import type { ConversationComposerDraft } from '~data/conversationComposerDrafts'

/*
  How many files the reader's message holds against what a message may: those in the tray, and those
  of the message whose send is going, which a failed send puts back beside them
*/
function countConversationComposerAttachments({
  attachments,
  sendingMessageId,
  pendingMessage,
}: Pick<ConversationComposerDraft, 'attachments' | 'sendingMessageId' | 'pendingMessage'>) {
  const sending =
    sendingMessageId !== null && pendingMessage?.id === sendingMessageId ? pendingMessage.attachments.length : 0

  return attachments.length + sending
}

export default countConversationComposerAttachments
