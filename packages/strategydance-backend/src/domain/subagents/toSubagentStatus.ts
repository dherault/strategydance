import { ConversationRunStatus } from 'strategydance-database/backend'

import type { SubagentStatus } from '~types'

/*
  Where a subagent stands, from the status of its latest run: a chained run's next is its latest, in
  the write that chains it, so a subagent between two runs of its chain reads as working. A subagent
  never waits on a question nor has a run consumed, which a conversation's run alone does, and those
  read as working too
*/
function toSubagentStatus(status: ConversationRunStatus): SubagentStatus {
  switch (status) {
    case ConversationRunStatus.PENDING:
      return 'WAITING_FOR_SLOT'
    case ConversationRunStatus.QUEUED:
      return 'QUEUED'
    case ConversationRunStatus.RUNNING:
    case ConversationRunStatus.CHAINED:
    case ConversationRunStatus.WAITING:
    case ConversationRunStatus.CONTINUED:
      return 'WORKING'
    case ConversationRunStatus.COMPLETED:
      return 'REPORTED'
    case ConversationRunStatus.STOPPED:
      return 'STOPPED'
    case ConversationRunStatus.FAILED:
    case ConversationRunStatus.REFUSED:
      return 'FAILED'
    case ConversationRunStatus.INTERRUPTED:
      return 'INTERRUPTED'
  }
}

export default toSubagentStatus
