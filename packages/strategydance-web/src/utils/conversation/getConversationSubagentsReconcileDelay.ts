import { ConversationRunStatus } from 'strategydance-database/web'

import type { Conversation, ConversationRun, ConversationSubagent } from '~types'

import { CONVERSATION_REACTION_RECONCILE_DELAY_MS, CONVERSATION_SUBAGENTS_RECONCILE_INTERVAL_MS } from '~constants'

/*
  How long a conversation's page waits before it first asks the backend to reconcile its subagents,
  then asks again as often: a few seconds when a reaction is due, a batch of them, those launched on
  one anchor, having reported whole with a report not delivered yet while the conversation could
  react, idle after a run that completed, not full and asking nothing, which a restored conversation
  whose subagents reported meanwhile is; two minutes while any subagent is busy, so one whose worker
  died ends; and null otherwise, when nothing is asked
*/
function getConversationSubagentsReconcileDelay(
  subagents: readonly ConversationSubagent[],
  conversation: Pick<Conversation, 'isFull' | 'activeRunId' | 'isAwaitingAnswer'>,
  run: Pick<ConversationRun, 'status'> | null,
) {
  if (isReactionDue(subagents, conversation, run)) return CONVERSATION_REACTION_RECONCILE_DELAY_MS
  if (subagents.some(({ activeRunId }) => activeRunId !== null)) return CONVERSATION_SUBAGENTS_RECONCILE_INTERVAL_MS

  return null
}

function isReactionDue(
  subagents: readonly ConversationSubagent[],
  { isFull, activeRunId, isAwaitingAnswer }: Pick<Conversation, 'isFull' | 'activeRunId' | 'isAwaitingAnswer'>,
  run: Pick<ConversationRun, 'status'> | null,
) {
  if (isFull || activeRunId || isAwaitingAnswer || run?.status !== ConversationRunStatus.COMPLETED) return false

  const anchors = new Set(subagents.map(({ launchAnchorPosition }) => launchAnchorPosition))

  return [...anchors].some(anchor => {
    const batch = subagents.filter(({ launchAnchorPosition }) => launchAnchorPosition === anchor)

    return (
      batch.every(({ reportedAt }) => reportedAt !== null)
      && batch.some(({ reportDeliveredAt }) => reportDeliveredAt === null)
    )
  })
}

export default getConversationSubagentsReconcileDelay
