import { setTimeout as wait } from 'node:timers/promises'

import { buildConversationPreview } from 'strategydance-core'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  getConversationRunContext,
  stopQueuedSubagentRun as stopQueuedSubagentRunMutation,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'
import buildSubagentReport from '~domain/subagents/buildSubagentReport'

// How many times a run is read and ended before the caller is told it could not be
const MAX_TRIES = 4

// Why it ended, for the logs
const FAILURE = "Its parent's agent stopped it while it was queued"

type Options = {
  // How long it waits after a refusal, times the refusals so far
  retryDelayMs?: number
}

/*
  Ends a subagent's run still waiting in the queue that its parent's agent asked to stop, at once
  rather than when a worker claims it, with its note and its report, read from the subagent's
  transcript as it stands, which a run its chain queued carries on from. Answers whether the run has
  ended stopped, by this or by a write of this whose answer was lost, so the slot it held is free and
  the caller promotes into it: a run a worker claimed meanwhile is left to stop at its next step, and
  ends by its worker, whose ending promotes, and one that ended otherwise is left as it is.

  A refusal is read again, since a note can find the counter moved. Throws once the counter keeps
  moving
*/
async function stopQueuedSubagentRun(
  reference: ConversationRunReference,
  { retryDelayMs = 200 }: Options = {},
): Promise<boolean> {
  for (let tries = 1; ; tries++) {
    const { data } = await getConversationRunContext(dataConnect, reference)
    const [run] = data.conversationRuns

    // Ended stopped, which a write whose answer was lost leaves: promoting once more fills no slot twice
    if (run?.status === ConversationRunStatus.STOPPED && run.stopRequestedAt) return true
    if (run?.status !== ConversationRunStatus.QUEUED || !run.stopRequestedAt) return false

    const entries = await readConversationTranscript(reference)

    try {
      await stopQueuedSubagentRunMutation(dataConnect, {
        ...reference,
        noteId: deriveConversationMessageId(reference.runId, 'note'),
        position: data.conversation?.nextMessagePosition ?? 0,
        preview: buildConversationPreview({ kind: 'NOTE', noteKind: ConversationNoteKind.STOPPED }),
        failure: FAILURE,
        report: buildSubagentReport(
          {
            kind: 'noted',
            status: ConversationRunStatus.STOPPED,
            noteKind: ConversationNoteKind.STOPPED,
            failure: FAILURE,
          },
          entries,
        ),
      })

      return true
    } catch (error) {
      if (tries === MAX_TRIES) throw error

      await wait(tries * retryDelayMs)
    }
  }
}

export default stopQueuedSubagentRun
