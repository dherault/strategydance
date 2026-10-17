import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

/*
  Stops every subagent of one of the reader's conversations that is still busy, as the strip above
  its composer's Stop all does: those queued or waiting for a slot end at once with their reports,
  and those at work stop within two seconds and report what they had. A stop sent twice stops once
*/
function useStopConversationSubagents() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function stopConversationSubagents(conversationId: string) {
    if (!organizationId) throw new Error('No organization is current')

    await requestApi({
      method: 'POST',
      path: `/organizations/${organizationId}/conversations/${conversationId}/subagents/stop`,
    })
  }
}

export default useStopConversationSubagents
