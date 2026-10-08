import type { ConversationRunStatus } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
import isDeadConversationRun from '~domain/conversations/isDeadConversationRun'

// One of the caller's runs in flight, as a route reads them before it starts another
type InFlightRun = {
  id: string
  status: ConversationRunStatus
  leaseExpiresAt?: string | null
  conversation: { id: string }
}

/*
  Finalizes each of the caller's runs in flight past its lease, in whichever conversation of theirs
  it goes, as a route does before it counts them or starts another, and answers whether any ended,
  which frees its conversation and the caller's allowance, so the route reads again. One still
  coming counts as in flight, as it was read
*/
async function finalizeDeadConversationRuns(
  { organizationId, userId }: Pick<ConversationRunReference, 'organizationId' | 'userId'>,
  runs: InFlightRun[],
) {
  let hasEnded = false

  for (const run of runs.filter(isDeadConversationRun)) {
    const state = await finalizeDeadConversationRun({
      organizationId,
      userId,
      conversationId: run.conversation.id,
      runId: run.id,
    })

    if (state === 'ended') hasEnded = true
  }

  return hasEnded
}

export default finalizeDeadConversationRuns
