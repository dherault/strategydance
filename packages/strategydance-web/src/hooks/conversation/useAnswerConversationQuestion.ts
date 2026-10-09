import type { AnswerConversationQuestionData, ConversationAnswer } from 'strategydance-core'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

/*
  Answers a question of the turn one of the reader's conversations in the current organization
  waits on: the backend checks the answer against the question, records it, and once no question of
  the turn waits, starts the run that carries the conversation on, answering with its id, or null
  while another question waits. The same answer sent again answers the same
*/
function useAnswerConversationQuestion() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function answerConversationQuestion({
    conversationId,
    messageId,
    answer,
  }: {
    conversationId: string
    messageId: string
    answer: ConversationAnswer
  }) {
    if (!organizationId) throw new Error('No organization is current')

    return requestApi<AnswerConversationQuestionData>({
      method: 'POST',
      path: `/organizations/${organizationId}/conversations/${conversationId}/answers`,
      body: { messageId, selected: answer.selected, other: answer.other },
    })
  }
}

export default useAnswerConversationQuestion
