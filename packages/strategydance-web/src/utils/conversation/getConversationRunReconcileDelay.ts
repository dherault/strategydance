import { ConversationRunStatus } from 'strategydance-database/web'

import type { ConversationRun } from '~types'

import { CONVERSATION_RUN_RECONCILE_MARGIN_MS } from '~constants'

/*
  How long a conversation's page waits before it asks the backend to reconcile its latest run: until
  the run's lease has passed, and a margin after, for a run queued or going, and 0 once that time
  has come. Null for a run that has ended, which nothing reconciles
*/
function getConversationRunReconcileDelay(run: Pick<ConversationRun, 'status' | 'leaseExpiresAt'> | null, now: number) {
  if (!run?.leaseExpiresAt) return null
  if (run.status !== ConversationRunStatus.QUEUED && run.status !== ConversationRunStatus.RUNNING) return null

  return Math.max(0, Date.parse(run.leaseExpiresAt) + CONVERSATION_RUN_RECONCILE_MARGIN_MS - now)
}

export default getConversationRunReconcileDelay
