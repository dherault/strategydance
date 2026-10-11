import { useSyncExternalStore } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import {
  type ConversationQuestionAnswerDraft,
  EMPTY_CONVERSATION_QUESTION_ANSWER,
  readConversationQuestionAnswer,
  subscribeToConversationQuestionAnswers,
  updateConversationQuestionAnswer,
} from '~data/conversationQuestionAnswers'

/*
  The answer the reader has under way to one of Strategy Dance's questions, as every view of its
  conversation shares it, and what changes it there: the signed-in account's in the current
  organization, as the composer's message is. Nothing is held while the document shell is
  prerendered
*/
function useConversationQuestionAnswer(messageId: string) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const key = `${viewer?.uid ?? ''}:${organization?.id ?? ''}:${messageId}`

  const answer = useSyncExternalStore(
    subscribeToConversationQuestionAnswers,
    () => readConversationQuestionAnswer(key),
    () => EMPTY_CONVERSATION_QUESTION_ANSWER,
  )

  function changeAnswer(
    change: (current: ConversationQuestionAnswerDraft) => Partial<ConversationQuestionAnswerDraft>,
  ) {
    updateConversationQuestionAnswer(key, current => ({ ...current, ...change(current) }))
  }

  return [answer, changeAnswer] as const
}

export default useConversationQuestionAnswer
