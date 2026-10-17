import type { ConversationRunQueue } from '~types'

import { CONVERSATION_RUN_QUEUE_PATH, SUBAGENT_RUN_QUEUE_PATH } from '~constants'

// The path of the Cloud Tasks queue a run goes through, as its tasks are created under it
function buildConversationRunQueuePath(queue: ConversationRunQueue) {
  return queue === 'subagent-runs' ? SUBAGENT_RUN_QUEUE_PATH : CONVERSATION_RUN_QUEUE_PATH
}

export default buildConversationRunQueuePath
