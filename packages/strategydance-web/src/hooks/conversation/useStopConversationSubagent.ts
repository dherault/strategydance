import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

/*
  Stops one subagent of one of the reader's conversations, named through the conversation that
  launched it: a run still queued, or waiting for a slot, ends at once with its report, and one at
  work stops within two seconds and reports what it had. The conversation's live list of subagents
  then shows it stopping, then stopped. A stop sent twice, or to a subagent that has ended, changes
  nothing
*/
function useStopConversationSubagent() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function stopConversationSubagent({
    conversationId,
    subagentId,
  }: {
    conversationId: string
    subagentId: string
  }) {
    if (!organizationId) throw new Error('No organization is current')

    await requestApi({
      method: 'POST',
      path: `/organizations/${organizationId}/conversations/${conversationId}/subagents/${subagentId}/stop`,
    })
  }
}

export default useStopConversationSubagent
