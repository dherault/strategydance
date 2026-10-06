import type { ConversationRunReference } from '~types'

import { ARE_CONVERSATION_RUNS_IN_PROCESS } from '~constants'

import logger from '~utils/logger'

import runConversation from '~domain/conversations/runConversation'

/*
  Starts a queued run, without waiting for it, in the backend's own process. Asking twice is safe,
  since only one worker claims a run, which is how a send retried after its run was queued completes
  what the first one did not. Refused where runs do not go in the process, which the routes check
  before they write anything
*/
function enqueueRun(reference: ConversationRunReference) {
  if (!ARE_CONVERSATION_RUNS_IN_PROCESS) throw new Error('Runs do not go in this process')

  runConversation(reference).catch(error => {
    logger.error(`Conversation run ${reference.runId} failed`, error)
  })
}

export default enqueueRun
