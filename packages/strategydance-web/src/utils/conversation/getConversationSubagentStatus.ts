import { ConversationRunStatus, ConversationRunTrigger } from 'strategydance-database/web'

import type { ConversationSubagent, ConversationSubagentStatus } from '~types'

/*
  Where a subagent stands, from its latest run, as the backend's `toSubagentStatus` reads it: waiting
  for one of its member's slots, queued for its first run, working, its later runs queued as it
  carries on included, stopping once asked while it is busy, or how it ended, reported when it
  completed. A subagent always has a run, and one without is taken as queued
*/
function getConversationSubagentStatus({ activeRunId, latestRuns }: ConversationSubagent): ConversationSubagentStatus {
  const run = latestRuns[0]

  if (!run) return 'queued'
  if (activeRunId && run.stopRequestedAt) return 'stopping'

  switch (run.status) {
    case ConversationRunStatus.PENDING:
      return 'waitingForSlot'
    case ConversationRunStatus.QUEUED:
      return run.trigger === ConversationRunTrigger.LAUNCH ? 'queued' : 'working'
    case ConversationRunStatus.RUNNING:
    case ConversationRunStatus.WAITING:
    case ConversationRunStatus.CONTINUED:
    case ConversationRunStatus.CHAINED:
      return 'working'
    case ConversationRunStatus.COMPLETED:
      return 'reported'
    case ConversationRunStatus.STOPPED:
      return 'stopped'
    case ConversationRunStatus.FAILED:
    case ConversationRunStatus.REFUSED:
      return 'failed'
    case ConversationRunStatus.INTERRUPTED:
      return 'interrupted'
  }
}

export default getConversationSubagentStatus
