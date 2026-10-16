import { ConversationRunStatus } from 'strategydance-database/web'

import type { ConversationRun } from '~types'

// How far a run has come: a status only ever moves to one further on. A subagent's run waits
// pending before it is queued, and one that chained has ended as the others have
const STATUS_RANKS = {
  [ConversationRunStatus.PENDING]: 0,
  [ConversationRunStatus.QUEUED]: 1,
  [ConversationRunStatus.RUNNING]: 2,
  [ConversationRunStatus.WAITING]: 3,
  [ConversationRunStatus.COMPLETED]: 4,
  [ConversationRunStatus.STOPPED]: 4,
  [ConversationRunStatus.FAILED]: 4,
  [ConversationRunStatus.REFUSED]: 4,
  [ConversationRunStatus.INTERRUPTED]: 4,
  [ConversationRunStatus.CHAINED]: 4,
  [ConversationRunStatus.CONTINUED]: 5,
} satisfies Record<ConversationRunStatus, number>

/*
  Whether a read of a conversation's latest run is older than another: an earlier run, the same run
  at a status it has moved past, which would show an ended run as going, or the same run at the same
  status before its member asked it to stop, which would offer Stop again. A run gone is never
  older: deleting its conversation, or losing access to it, reads so
*/
function isOlderConversationRun(current: ConversationRun | undefined, next: ConversationRun | undefined) {
  if (!current || !next) return false
  if (next.number !== current.number) return next.number < current.number
  if (STATUS_RANKS[next.status] !== STATUS_RANKS[current.status]) {
    return STATUS_RANKS[next.status] < STATUS_RANKS[current.status]
  }

  return !!current.stopRequestedAt && !next.stopRequestedAt
}

export default isOlderConversationRun
