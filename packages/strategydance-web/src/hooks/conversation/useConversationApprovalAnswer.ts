import { useSyncExternalStore } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import {
  type ConversationApprovalAnswerDraft,
  EMPTY_CONVERSATION_APPROVAL_ANSWER,
  readConversationApprovalAnswer,
  subscribeToConversationApprovalAnswers,
  updateConversationApprovalAnswer,
} from '~data/conversationApprovalAnswers'

/*
  The decision the reader has under way on a call waiting for their approval, as every view of its
  conversation shares it, and what changes it there: the signed-in account's in the current
  organization, as a question's answer is. Nothing is held while the document shell is prerendered
*/
function useConversationApprovalAnswer(messageId: string) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const key = `${viewer?.uid ?? ''}:${organization?.id ?? ''}:${messageId}`

  const answer = useSyncExternalStore(
    subscribeToConversationApprovalAnswers,
    () => readConversationApprovalAnswer(key),
    () => EMPTY_CONVERSATION_APPROVAL_ANSWER,
  )

  function changeAnswer(change: Partial<ConversationApprovalAnswerDraft>) {
    updateConversationApprovalAnswer(key, current => ({ ...current, ...change }))
  }

  return [answer, changeAnswer] as const
}

export default useConversationApprovalAnswer
