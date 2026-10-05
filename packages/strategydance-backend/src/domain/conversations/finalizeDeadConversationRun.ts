import { setTimeout as wait } from 'node:timers/promises'

import { buildConversationPreview } from 'strategydance-core'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  getConversationRunContext,
  interruptDeadConversationRun,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'

// How many times a run is read and finalized before the caller is told it could not be
const MAX_TRIES = 4

type Options = {
  // How long it waits after a refusal, times the refusals so far
  retryDelayMs?: number
}

/*
  Finalizes a run that died with its worker, as a route finds it before it starts another: queued or
  claimed, past its lease. It ends interrupted, with its note at the counter of its own
  conversation, which may not be the one the route is about, so that conversation's page is the one
  that refreshes. Answers whether the run has ended, by this or before it, and false for one still
  alive.

  A refusal is read again, since something can move the counter or end the run meanwhile: a worker
  that renewed its lease keeps it, and a run something else ended is left as it is. Throws once the
  counter keeps moving
*/
async function finalizeDeadConversationRun(reference: ConversationRunReference, { retryDelayMs = 200 }: Options = {}) {
  for (let tries = 1; ; tries++) {
    const { data } = await getConversationRunContext(dataConnect, reference)
    const [run] = data.conversationRuns

    if (!run || (run.status !== ConversationRunStatus.QUEUED && run.status !== ConversationRunStatus.RUNNING)) {
      return true
    }

    if (!run.leaseExpiresAt || Date.parse(run.leaseExpiresAt) >= Date.now()) return false

    try {
      await interruptDeadConversationRun(dataConnect, {
        ...reference,
        noteId: deriveConversationMessageId(reference.runId, 'note'),
        position: data.conversation?.nextMessagePosition ?? 0,
        preview: buildConversationPreview({ kind: 'NOTE', noteKind: ConversationNoteKind.INTERRUPTED }),
      })

      return true
    } catch (error) {
      if (tries === MAX_TRIES) throw error

      await wait(tries * retryDelayMs)
    }
  }
}

export default finalizeDeadConversationRun
