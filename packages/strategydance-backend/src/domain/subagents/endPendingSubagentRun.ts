import { setTimeout as wait } from 'node:timers/promises'

import { buildConversationPreview } from 'strategydance-core'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  getConversationRunContext,
  interruptPendingSubagentRun,
  stopPendingSubagentRun,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'
import buildSubagentReport from '~domain/subagents/buildSubagentReport'

// How many times a run is read and ended before the caller is told it could not be
const MAX_TRIES = 4

type Options = {
  // How long it waits after a refusal, times the refusals so far
  retryDelayMs?: number
}

/*
  Ends a subagent's run waiting for a slot that the promotion skips, as the reconcile and the sweep
  find it (`decidePendingSubagentRun`): stopped, when it was asked to stop or its subagent was
  deleted, or interrupted, when no membership has the `createdAt` it was launched under any more.
  Each with its note and its report, read from the subagent's transcript as it stands, which says how
  it ended. It held no slot, so nothing is promoted after it.

  A refusal is read again, since a note can find the counter moved, and a run something else ended
  or promoted meanwhile is left as it is. Throws once the counter keeps moving
*/
async function endPendingSubagentRun(
  reference: ConversationRunReference,
  fate: 'stopped' | 'interrupted',
  { retryDelayMs = 200 }: Options = {},
) {
  for (let tries = 1; ; tries++) {
    const { data } = await getConversationRunContext(dataConnect, reference)
    const [run] = data.conversationRuns

    if (run?.status !== ConversationRunStatus.PENDING) return

    const entries = await readConversationTranscript(reference)
    const note = {
      ...reference,
      noteId: deriveConversationMessageId(reference.runId, 'note'),
      position: data.conversation?.nextMessagePosition ?? 0,
    }

    try {
      if (fate === 'stopped') {
        const failure = data.conversation?.deletedAt
          ? 'Its subagent was deleted while it waited for a slot'
          : 'Its member asked it to stop while it waited for a slot'

        await stopPendingSubagentRun(dataConnect, {
          ...note,
          preview: buildConversationPreview({ kind: 'NOTE', noteKind: ConversationNoteKind.STOPPED }),
          failure,
          report: buildSubagentReport(
            { kind: 'noted', status: ConversationRunStatus.STOPPED, noteKind: ConversationNoteKind.STOPPED, failure },
            entries,
          ),
        })
      } else {
        const failure = data.userOrganization
          ? 'Its author was invited back while it waited for a slot'
          : 'Its author left the organization while it waited for a slot'

        await interruptPendingSubagentRun(dataConnect, {
          ...note,
          membershipCreatedAt: run.membershipCreatedAt,
          preview: buildConversationPreview({ kind: 'NOTE', noteKind: ConversationNoteKind.INTERRUPTED }),
          failure,
          report: buildSubagentReport({ kind: 'interrupted', reference, attempts: run.attempts, failure }, entries),
        })
      }

      return
    } catch (error) {
      if (tries === MAX_TRIES) throw error

      await wait(tries * retryDelayMs)
    }
  }
}

export default endPendingSubagentRun
