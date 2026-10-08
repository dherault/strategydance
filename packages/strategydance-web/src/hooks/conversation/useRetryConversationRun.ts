import type { RetryConversationRunData } from 'strategydance-core'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

/*
  Retries a run of one of the reader's conversations in the current organization that ended with a
  note: the backend goes back to the reader's message the run answered, deletes what was drawn
  after it, and starts a run that answers it again, answering with its id and the runs whose
  messages went. A retry sent again answers with the same run
*/
function useRetryConversationRun() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function retryConversationRun({ conversationId, runId }: { conversationId: string; runId: string }) {
    if (!organizationId) throw new Error('No organization is current')

    return requestApi<RetryConversationRunData>({
      method: 'POST',
      path: `/organizations/${organizationId}/conversations/${conversationId}/runs/${runId}/retry`,
    })
  }
}

export default useRetryConversationRun
