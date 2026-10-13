// The cache entry of a file's bytes as the thread draws it, which names whose read it is: the tab's
// cache outlives a sign-out
function getConversationAttachmentQueryKey(
  organizationId: string | null,
  conversationId: string,
  attachmentId: string,
  viewerId: string | null,
) {
  return ['ConversationAttachmentFile', organizationId, conversationId, attachmentId, viewerId]
}

export default getConversationAttachmentQueryKey
