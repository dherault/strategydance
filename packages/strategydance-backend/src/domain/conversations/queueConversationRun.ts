import { setTimeout as wait } from 'node:timers/promises'

import { Status } from 'google-gax'

import type { ConversationRunReference } from '~types'

import {
  CONVERSATION_RUN_DISPATCH_DEADLINE_SECONDS,
  CONVERSATION_RUN_QUEUE_PATH,
  CONVERSATION_TASKS_SERVICE_ACCOUNT,
  WORKER_URL,
} from '~constants'

import getCloudTasksClient from '~utils/getCloudTasksClient'
import logger from '~utils/logger'
import readGrpcCode from '~utils/readGrpcCode'

import buildConversationRunTaskName from '~domain/conversations/buildConversationRunTaskName'

// How many times a run's task is asked for when the answer leaves it unclear whether it exists
const MAX_TRIES = 3

// How long one ask may take, with the client's own retries off, since these are the retries
const CALL_TIMEOUT_MS = 10 * 1000

// The failures after which the task may exist or not: the request may have reached Cloud Tasks and
// only its answer been lost. An error without a code, a connection lost, is one too
const UNCLEAR_CODES: ReadonlySet<number> = new Set([
  Status.DEADLINE_EXCEEDED,
  Status.UNAVAILABLE,
  Status.UNKNOWN,
  Status.INTERNAL,
  Status.ABORTED,
])

type Options = {
  // How long it waits after an unclear failure, times the tries so far
  retryDelayMs?: number
}

/*
  Queues the Cloud Tasks task that delivers a run to the worker: a POST of the run to
  `/internal/conversation-runs`, signed with an OIDC token for `conversation-tasks`, whose audience
  is the worker's address, which Cloud Run checks. Answers `queued` once the task exists, and
  `unavailable` when it could not be queued, which the caller answers with a 503.

  The task is named after its run, so asking again is safe: `ALREADY_EXISTS` counts as queued. A
  failure that leaves it unclear whether the task exists is asked again under the same name, and a
  definite one is not. Cloud Tasks keeps a name for about an hour after its task ends, so a run whose
  task has come and gone reads as queued too, until the reconcile route finds no task
*/
async function queueConversationRun(
  { organizationId, userId, conversationId, runId }: ConversationRunReference,
  { retryDelayMs = 250 }: Options = {},
): Promise<'queued' | 'unavailable'> {
  const request = {
    parent: CONVERSATION_RUN_QUEUE_PATH,
    task: {
      name: buildConversationRunTaskName(runId),
      dispatchDeadline: { seconds: CONVERSATION_RUN_DISPATCH_DEADLINE_SECONDS },
      httpRequest: {
        httpMethod: 'POST' as const,
        url: `${WORKER_URL}/internal/conversation-runs`,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify({ organizationId, userId, conversationId, runId })).toString('base64'),
        oidcToken: { serviceAccountEmail: CONVERSATION_TASKS_SERVICE_ACCOUNT, audience: WORKER_URL },
      },
    },
  }

  for (let tries = 1; ; tries++) {
    try {
      await getCloudTasksClient().createTask(request, { timeout: CALL_TIMEOUT_MS, retry: null })

      return 'queued'
    } catch (error) {
      const code = readGrpcCode(error)

      if (code === Status.ALREADY_EXISTS) return 'queued'

      if (tries === MAX_TRIES || (code !== null && !UNCLEAR_CODES.has(code))) {
        logger.error(`Conversation run ${runId}: its task could not be queued`, error)

        return 'unavailable'
      }

      logger.warn(`Conversation run ${runId}: queueing its task may have failed, and is asked again`, error)

      await wait(tries * retryDelayMs)
    }
  }
}

export default queueConversationRun
