import type { Conversation, ConversationSummary } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'

/*
  Whether the reader started a conversation, and so writes in it, answers it and changes it, rather
  than reading it as another member of the organization does. A draft, not stored yet, is the
  reader's own
*/
function useIsConversationAuthor(conversation: Conversation | ConversationSummary | null) {
  const { data: viewer } = useAuthentication()

  return !conversation || conversation.user.id === viewer?.uid
}

export default useIsConversationAuthor
