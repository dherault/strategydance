import { Status } from 'google-gax'

import getCloudTasksClient from '~utils/getCloudTasksClient'
import logger from '~utils/logger'
import readGrpcCode from '~utils/readGrpcCode'

import buildConversationRunTaskName from '~domain/conversations/buildConversationRunTaskName'

// How long the lookup may take, with the client's own retries off: an answer that does not come is
// `unknown`, and the page asks again two minutes later
const CALL_TIMEOUT_MS = 10 * 1000

/*
  Whether the task that delivers a run is still in Cloud Tasks' queue: `queued` while it waits or
  is being delivered, `gone` once it is not, delivered or given up on after its last attempt or never
  queued, and `unknown` when Cloud Tasks could not say, which the caller answers by changing nothing
*/
async function findConversationRunTask(runId: string): Promise<'queued' | 'gone' | 'unknown'> {
  try {
    await getCloudTasksClient().getTask(
      { name: buildConversationRunTaskName(runId) },
      { timeout: CALL_TIMEOUT_MS, retry: null },
    )

    return 'queued'
  } catch (error) {
    if (readGrpcCode(error) === Status.NOT_FOUND) return 'gone'

    logger.warn(`Conversation run ${runId}: Cloud Tasks could not say whether its task is queued`, error)

    return 'unknown'
  }
}

export default findConversationRunTask
