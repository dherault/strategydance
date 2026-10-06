import { ConversationRunStatus } from 'strategydance-database/web'

import type { ConversationRun } from '~types'

/*
  Whether a conversation's latest run is still going: queued or running. The thread shows the
  thinking indicator while it is, and nothing can be sent, since the backend refuses a second run
  beside it
*/
function isConversationRunGoing(run: Pick<ConversationRun, 'status'> | null) {
  return run?.status === ConversationRunStatus.QUEUED || run?.status === ConversationRunStatus.RUNNING
}

export default isConversationRunGoing
