import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

/*
  Stops a run of one of the reader's conversations in the current organization: one still queued
  ends at once, with its note, and one Strategy Dance works on stops within two seconds. The page's
  live reads then show it stopping, then the note. A stop sent twice stops once
*/
function useStopConversationRun() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function stopConversationRun({ conversationId, runId }: { conversationId: string; runId: string }) {
    if (!organizationId) throw new Error('No organization is current')

    await requestApi({
      method: 'POST',
      path: `/organizations/${organizationId}/conversations/${conversationId}/runs/${runId}/stop`,
    })
  }
}

export default useStopConversationRun
