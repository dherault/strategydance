import { CONVERSATION_RUN_QUEUE_PATH } from '~constants'

/*
  The name of the Cloud Tasks task that delivers a run, after the run, so there is one per run:
  queueing a run twice queues it once, Cloud Tasks answering the second with `ALREADY_EXISTS`. Run
  ids are random, which spreads the names as Cloud Tasks asks, where sequential ones slow a queue
*/
function buildConversationRunTaskName(runId: string) {
  return `${CONVERSATION_RUN_QUEUE_PATH}/tasks/run-${runId}`
}

export default buildConversationRunTaskName
