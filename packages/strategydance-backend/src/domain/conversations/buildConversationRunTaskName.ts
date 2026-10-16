import type { ConversationRunQueue } from '~types'

import buildConversationRunQueuePath from '~domain/conversations/buildConversationRunQueuePath'

/*
  The name of the Cloud Tasks task that delivers a run, after the run and under its queue, so there
  is one per run: queueing a run twice queues it once, Cloud Tasks answering the second with
  `ALREADY_EXISTS`. Run ids are random, which spreads the names as Cloud Tasks asks, where
  sequential ones slow a queue
*/
function buildConversationRunTaskName(runId: string, queue: ConversationRunQueue) {
  return `${buildConversationRunQueuePath(queue)}/tasks/run-${runId}`
}

export default buildConversationRunTaskName
