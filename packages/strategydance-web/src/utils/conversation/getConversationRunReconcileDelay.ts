import { ConversationRunStatus } from 'strategydance-database/web'

import type { ConversationRun } from '~types'

import { CONVERSATION_ANSWER_RECONCILE_DELAY_MS, CONVERSATION_RUN_RECONCILE_MARGIN_MS } from '~constants'

/*
  How long a conversation's page waits before it asks the backend to reconcile its latest run: until
  the run's lease has passed, and a margin after, for a run queued or going, and 0 once that time
  has come. A run waiting on questions the thread shows all answered is asked after a few seconds,
  in case its last answer could not carry it on. Null for a run that has ended otherwise, which
  nothing reconciles
*/
function getConversationRunReconcileDelay(
  run: Pick<ConversationRun, 'status' | 'leaseExpiresAt'> | null,
  now: number,
  { isEveryQuestionAnswered = false } = {},
) {
  if (run?.status === ConversationRunStatus.WAITING)
    return isEveryQuestionAnswered ? CONVERSATION_ANSWER_RECONCILE_DELAY_MS : null
  if (!run?.leaseExpiresAt) return null
  if (run.status !== ConversationRunStatus.QUEUED && run.status !== ConversationRunStatus.RUNNING) return null

  return Math.max(0, Date.parse(run.leaseExpiresAt) + CONVERSATION_RUN_RECONCILE_MARGIN_MS - now)
}

export default getConversationRunReconcileDelay
