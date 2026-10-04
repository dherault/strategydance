import { ConversationRunStatus } from 'strategydance-database/web'

import type { ConversationRun } from '~types'

// How far a run has come: a status only ever moves to one further on
const STATUS_RANKS = {
  [ConversationRunStatus.QUEUED]: 0,
  [ConversationRunStatus.RUNNING]: 1,
  [ConversationRunStatus.WAITING]: 2,
  [ConversationRunStatus.COMPLETED]: 3,
  [ConversationRunStatus.STOPPED]: 3,
  [ConversationRunStatus.FAILED]: 3,
  [ConversationRunStatus.REFUSED]: 3,
  [ConversationRunStatus.INTERRUPTED]: 3,
  [ConversationRunStatus.CONTINUED]: 4,
} satisfies Record<ConversationRunStatus, number>

/*
  Whether a read of a conversation's latest run is older than another: an earlier run, or the same
  run at a status it has moved past, which would show an ended run as going. A run gone is never
  older: deleting its conversation, or losing access to it, reads so
*/
function isOlderConversationRun(current: ConversationRun | undefined, next: ConversationRun | undefined) {
  if (!current || !next) return false
  if (next.number !== current.number) return next.number < current.number

  return STATUS_RANKS[next.status] < STATUS_RANKS[current.status]
}

export default isOlderConversationRun
