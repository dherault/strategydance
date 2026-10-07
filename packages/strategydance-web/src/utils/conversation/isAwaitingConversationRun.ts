import type { ConversationRun } from '~types'

// The run a message's first send started, before the page's read of the latest run has shown it.
// A first send always starts a run of its own, the conversation's latest, which the read moves to
export type StartedConversationRun = {
  runId: string
  // The latest run the page had read when the send went, or null before the first
  previousRunId: string | null
}

/*
  Whether a run a send started is still to show in the page's read of the latest run. The backend
  answers once the run is stored, and the live read follows on its own, a moment later: until it
  does, the run counts as going, so nothing else is sent beside it. Any run the read moves on to
  counts as having caught up, the one started or one sent after it from another tab, so a read that
  skips past it never holds sending back for good
*/
function isAwaitingConversationRun(started: StartedConversationRun | null, run: Pick<ConversationRun, 'id'> | null) {
  if (!started) return false

  const runId = run?.id ?? null

  return runId !== started.runId && runId === started.previousRunId
}

export default isAwaitingConversationRun
