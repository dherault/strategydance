import { getConversationRunStop } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

// Whether the run's member asked to stop it, read with the run's keys alone, which the read declares
async function isConversationRunStopRequested({
  organizationId,
  userId,
  conversationId,
  runId,
}: ConversationRunReference) {
  const { data } = await getConversationRunStop(dataConnect, { organizationId, userId, conversationId, runId })

  return Boolean(data.conversationRuns[0]?.stopRequestedAt)
}

export default isConversationRunStopRequested
