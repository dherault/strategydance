import { ConversationRunStatus } from 'strategydance-database/backend'

// Whether a run is in flight past its lease, which says its worker died with it, unless it is
// queued and still coming, as Cloud Tasks says
function isDeadConversationRun(run: { status: ConversationRunStatus; leaseExpiresAt?: string | null }) {
  return (
    (run.status === ConversationRunStatus.QUEUED || run.status === ConversationRunStatus.RUNNING)
    && Boolean(run.leaseExpiresAt)
    && Date.parse(run.leaseExpiresAt ?? '') < Date.now()
  )
}

export default isDeadConversationRun
