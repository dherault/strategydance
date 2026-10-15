import { type ConversationPreview, buildConversationPreview } from 'strategydance-core'
import {
  ConversationNoteKind,
  type ConversationRunStatus,
  finishConversationRun,
  finishConversationRunWaiting,
  finishConversationRunWithNote,
  finishSubagentRun,
  finishSubagentRunWithNote,
  interruptConversationRun,
  interruptSubagentRun,
} from 'strategydance-database/backend'

import type { ConversationRunFence, ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import type { ConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'
import buildSubagentReport from '~domain/subagents/buildSubagentReport'

/*
  How a worker ends its run:

  - `finished`: completed, or stopped in a conversation deleted meanwhile, without a note
  - `waiting`: on the questions its turn asked, until an answer or a send consumes the turn
  - `noted`: with a note the thread draws, and why, for the logs: failed, at a limit that sends no
    further request, which `isAtLimit` says, or after Claude's API failed it, full when its next
    request would not fit Claude's context, which marks its conversation so, stopped as its member
    asked, or refused
  - `interrupted`: its author is no longer the member it was queued under, fenced on the run alone,
    at the attempt the worker read or claimed, with the note saying so and why
*/
export type ConversationRunEnding =
  | {
      kind: 'finished'
      status: ConversationRunStatus.COMPLETED | ConversationRunStatus.STOPPED
      usage?: ConversationRunUsage
    }
  | ({
      kind: 'noted'
      failure: string
      usage?: ConversationRunUsage
      isFull?: boolean
      isAtLimit?: boolean
    } & (
      | { status: ConversationRunStatus.FAILED; noteKind: ConversationNoteKind.FAILED | ConversationNoteKind.FULL }
      | { status: ConversationRunStatus.STOPPED; noteKind: ConversationNoteKind.STOPPED }
      | { status: ConversationRunStatus.REFUSED; noteKind: ConversationNoteKind.REFUSED }
    ))
  // With the preview of a call it cancels, when the preview shows it
  | { kind: 'waiting'; usage?: ConversationRunUsage; preview?: ConversationPreview | null }
  | { kind: 'interrupted'; reference: ConversationRunReference; attempts: number; failure: string }

type EndConversationRunInput = {
  ending: ConversationRunEnding
  // The worker's fence and its lease, which a worker that has not claimed its run yet has neither of
  fence: ConversationRunFence | null
  lease: ConversationRunLease | null
  // The conversation's counter, where a note goes
  position: number
  // Whether the conversation is a subagent, whose run ends with its report
  isSubagent: boolean
}

/*
  Ends a run as its worker decided, in one write, which settles its usage ledger when the worker
  holds one. A note's id derives from the run, which has one at most, so a route that finalizes the
  same run meanwhile and the worker never both add theirs. A note at a counter something moved
  meanwhile is refused, and the worker reads again and retries.

  A subagent's run ends through the subagent's own endings, which write its report in the same
  write, however it ends (`buildSubagentReport`), read from its transcript as it stands. A subagent
  never waits, since nobody answers it
*/
async function endConversationRun({ ending, fence, lease, position, isSubagent }: EndConversationRunInput) {
  const write = <T>(operation: () => Promise<T>) => (lease ? lease.write(operation) : operation())

  if (isSubagent) {
    await endSubagentRun({ ending, fence, position, write })

    return
  }

  if (ending.kind === 'interrupted') {
    await write(() =>
      interruptConversationRun(dataConnect, {
        ...ending.reference,
        attempts: ending.attempts,
        noteId: deriveConversationMessageId(ending.reference.runId, 'note'),
        position,
        preview: buildConversationPreview({ kind: 'NOTE', noteKind: ConversationNoteKind.INTERRUPTED }),
        failure: ending.failure,
      }),
    )

    return
  }

  if (!fence) throw new Error('A run ends as its worker decides only once it is claimed')

  if (ending.kind === 'waiting') {
    await write(() =>
      finishConversationRunWaiting(dataConnect, {
        ...fence,
        ...(ending.usage ? { usage: ending.usage } : {}),
        ...(ending.preview ? { preview: ending.preview } : {}),
      }),
    )

    return
  }

  if (ending.kind === 'finished') {
    await write(() =>
      finishConversationRun(dataConnect, {
        ...fence,
        status: ending.status,
        ...(ending.usage ? { usage: ending.usage } : {}),
      }),
    )

    return
  }

  await write(() =>
    finishConversationRunWithNote(dataConnect, {
      ...fence,
      status: ending.status,
      noteKind: ending.noteKind,
      noteId: deriveConversationMessageId(fence.runId, 'note'),
      position,
      preview: buildConversationPreview({ kind: 'NOTE', noteKind: ending.noteKind }),
      failure: ending.failure,
      ...(ending.usage ? { usage: ending.usage } : {}),
      ...(ending.isFull ? { isFull: true } : {}),
    }),
  )
}

type EndSubagentRunInput = Omit<EndConversationRunInput, 'lease' | 'isSubagent'> & {
  write: <T>(operation: () => Promise<T>) => Promise<T>
}

// Ends a subagent's run as its worker decided, with its report, in one write
async function endSubagentRun({ ending, fence, position, write }: EndSubagentRunInput) {
  if (ending.kind === 'waiting') throw new Error('A subagent never waits: nobody answers it')

  const reference = ending.kind === 'interrupted' ? ending.reference : fence

  if (!reference) throw new Error('A run ends as its worker decides only once it is claimed')

  const report = buildSubagentReport(ending, await readConversationTranscript(reference))

  if (ending.kind === 'interrupted') {
    await write(() =>
      interruptSubagentRun(dataConnect, {
        ...ending.reference,
        attempts: ending.attempts,
        noteId: deriveConversationMessageId(ending.reference.runId, 'note'),
        position,
        preview: buildConversationPreview({ kind: 'NOTE', noteKind: ConversationNoteKind.INTERRUPTED }),
        failure: ending.failure,
        report,
      }),
    )

    return
  }

  if (!fence) throw new Error('A run ends as its worker decides only once it is claimed')

  if (ending.kind === 'finished') {
    await write(() =>
      finishSubagentRun(dataConnect, {
        ...fence,
        status: ending.status,
        ...(ending.usage ? { usage: ending.usage } : {}),
        report,
      }),
    )

    return
  }

  await write(() =>
    finishSubagentRunWithNote(dataConnect, {
      ...fence,
      status: ending.status,
      noteKind: ending.noteKind,
      noteId: deriveConversationMessageId(fence.runId, 'note'),
      position,
      preview: buildConversationPreview({ kind: 'NOTE', noteKind: ending.noteKind }),
      failure: ending.failure,
      ...(ending.usage ? { usage: ending.usage } : {}),
      ...(ending.isFull ? { isFull: true } : {}),
      report,
    }),
  )
}

export default endConversationRun
