import { expireQueuedConversationRunLease } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { ARE_CONVERSATION_RUNS_IN_PROCESS } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import queueConversationRun from '~domain/conversations/queueConversationRun'
import runConversation from '~domain/conversations/runConversation'

/*
  Sends a queued run on its way, and answers whether it is: in development it starts in the
  backend's own process, without being waited for, and in production its task is queued for the
  worker. Asking twice is safe, since a run has one task and only one worker claims it, which is how
  a send retried after its run was queued completes what the first one did not.

  A run whose task could not be queued stays queued, and its lease is brought in to now, so its page
  asks the backend to reconcile it at once, which queues the task again, rather than twenty minutes
  later
*/
async function enqueueRun(reference: ConversationRunReference) {
  const { organizationId, userId, conversationId, runId } = reference

  if (ARE_CONVERSATION_RUNS_IN_PROCESS) {
    runConversation(reference).catch(error => {
      logger.error(`Conversation run ${runId} failed`, error)
    })

    return true
  }

  if ((await queueConversationRun(reference)) === 'queued') return true

  try {
    await expireQueuedConversationRunLease(dataConnect, { organizationId, userId, conversationId, runId })
  } catch (error) {
    logger.error(`Conversation run ${runId}: its lease could not be brought in after its task failed`, error)
  }

  return false
}

export default enqueueRun
