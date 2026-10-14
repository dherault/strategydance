import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

type Options = {
  // The run the backend answered the send with
  runId: string
  // The latest run the page had read when the send went, or null before the first
  previousRunId: string | null
  // For a message sent again after a failure, the latest run the page had read when it was first
  // sent. Left out for a first send
  firstPreviousRunId?: string | null
}

/*
  The run a send started, which counts as going until the read of the latest run shows it, or null
  when it may be older than a run the read will settle on. A message's first send starts a run newer
  than any read. Sent again after a failure, it is answered with the run the first send started,
  should that have reached the backend, or one it starts now: both newer than the run the read showed
  when the message was first sent, so the run counts while the read still shows that one. Once the
  read has moved on, the run answered can be older than one another tab has started since, which the
  read would never move on from
*/
function getConversationSendStartedRun({
  runId,
  previousRunId,
  firstPreviousRunId,
}: Options): StartedConversationRun | null {
  if (firstPreviousRunId !== undefined && firstPreviousRunId !== previousRunId) return null

  return { runId, previousRunId }
}

export default getConversationSendStartedRun
