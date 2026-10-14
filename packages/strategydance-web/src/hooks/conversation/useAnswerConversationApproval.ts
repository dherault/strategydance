import type { AnswerConversationApprovalData } from 'strategydance-core'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

/*
  Allows or denies a call of the turn one of the reader's conversations in the current organization
  waits on: the backend records the decision, denying an Allow instead when the server changed since
  the call was proposed, and once nothing of the turn waits, starts the run that carries the
  conversation on, answering with its id, or null while a question still waits. The same decision
  sent again answers the same
*/
function useAnswerConversationApproval() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function answerConversationApproval({
    conversationId,
    messageId,
    isAllowed,
  }: {
    conversationId: string
    messageId: string
    isAllowed: boolean
  }) {
    if (!organizationId) throw new Error('No organization is current')

    return requestApi<AnswerConversationApprovalData>({
      method: 'POST',
      path: `/organizations/${organizationId}/conversations/${conversationId}/approvals`,
      body: { messageId, isAllowed },
    })
  }
}

export default useAnswerConversationApproval
