import type { ResumeConversationRunData } from 'strategydance-core'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

/*
  Resumes a run of one of the reader's conversations in the current organization that was stopped
  or interrupted, from its note: the backend deletes the note and starts a run that carries the
  response on, answering with its id. A resume sent again answers with the same run
*/
function useResumeConversationRun() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function resumeConversationRun({ conversationId, runId }: { conversationId: string; runId: string }) {
    if (!organizationId) throw new Error('No organization is current')

    return requestApi<ResumeConversationRunData>({
      method: 'POST',
      path: `/organizations/${organizationId}/conversations/${conversationId}/runs/${runId}/resume`,
    })
  }
}

export default useResumeConversationRun
