import { setTimeout as wait } from 'node:timers/promises'

import { buildConversationPreview } from 'strategydance-core'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  getConversationRunContext,
  requestConversationRunStop,
  stopQueuedConversationRun,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
import isDeadConversationRun from '~domain/conversations/isDeadConversationRun'

// How many times a stop reads where its run stands and tries, before the caller is told it could not
const MAX_TRIES = 4

type Options = {
  // How long it waits after a refusal, times the refusals so far
  retryDelayMs?: number
}

/*
  Stops a run as its member asked, and answers `stopped` once it is stopped or asked to stop, or
  `missing` for a run that is not in the caller's conversation, or whose conversation was deleted:

  - a run that has ended is left as it is, so a stop sent twice stops once
  - a run past its lease died with its worker, and ends interrupted, as every route finalizes it
  - a run still queued ends stopped at once, with its note, so the member can send again straight
    away, and a task that delivers it later finds it ended and does nothing
  - a run a worker holds is asked to stop: the worker reads it before its next request and every two
    seconds while one streams, then ends the run stopped, with its note

  A queued run a worker claimed between the read and the stop, or a note at a counter something
  moved, is read again
*/
async function stopConversationRun(
  reference: ConversationRunReference,
  { retryDelayMs = 200 }: Options = {},
): Promise<{ outcome: 'stopped' | 'missing' }> {
  for (let tries = 1; ; tries++) {
    const { data } = await getConversationRunContext(dataConnect, reference)
    const [run] = data.conversationRuns

    if (!run || !data.conversation || data.conversation.deletedAt) return { outcome: 'missing' }

    if (run.status !== ConversationRunStatus.QUEUED && run.status !== ConversationRunStatus.RUNNING) {
      return { outcome: 'stopped' }
    }

    // A queued run past its lease that is still coming is stopped as any queued run is
    if (isDeadConversationRun(run) && (await finalizeDeadConversationRun(reference)) !== 'alive') {
      return { outcome: 'stopped' }
    }

    try {
      if (run.status === ConversationRunStatus.QUEUED) {
        await stopQueuedConversationRun(dataConnect, {
          ...reference,
          noteId: deriveConversationMessageId(reference.runId, 'note'),
          position: data.conversation.nextMessagePosition,
          preview: buildConversationPreview({ kind: 'NOTE', noteKind: ConversationNoteKind.STOPPED }),
        })
      } else {
        // Asked already, or ended meanwhile, either of which is as good
        await requestConversationRunStop(dataConnect, reference)
      }

      return { outcome: 'stopped' }
    } catch (error) {
      if (tries === MAX_TRIES) throw error

      await wait(tries * retryDelayMs)
    }
  }
}

export default stopConversationRun
