import { type ConversationPreview, buildConversationPreview } from 'strategydance-core'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  chainSubagentRun,
  finishConversationRun,
  finishConversationRunWaiting,
  finishConversationRunWithNote,
  finishSubagentRun,
  finishSubagentRunWithNote,
  getConversationRunStop,
  interruptConversationRun,
  interruptSubagentRun,
} from 'strategydance-database/backend'

import type { ConversationRunFence, ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import type { ConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'
import buildSubagentReport from '~domain/subagents/buildSubagentReport'
import deriveChainedRunId from '~domain/subagents/deriveChainedRunId'
import promoteSubagentRuns from '~domain/subagents/promoteSubagentRuns'

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

/*
  What a subagent's run hands on to when it reaches one of its limits before its fourth run: its
  number and its anchor, which the next run carries on from, and the results its turn's calls kept,
  when the ten minutes came between them
*/
export type SubagentChain = {
  runNumber: number
  anchorPosition: number
  pendingToolResults: string | null
}

type EndConversationRunInput = {
  ending: ConversationRunEnding
  // The worker's fence and its lease, which a worker that has not claimed its run yet has neither of
  fence: ConversationRunFence | null
  lease: ConversationRunLease | null
  // The conversation's counter, where a note goes
  position: number
  // Whether the conversation is a subagent, whose run ends with its report
  isSubagent: boolean
  // What a subagent's run hands on to at its limits, null for its fourth run and every other run
  chain?: SubagentChain | null
}

/*
  Ends a run as its worker decided, in one write, which settles its usage ledger when the worker
  holds one. A note's id derives from the run, which has one at most, so a route that finalizes the
  same run meanwhile and the worker never both add theirs. A note at a counter something moved
  meanwhile is refused, and the worker reads again and retries.

  A subagent's run ends through the subagent's own endings, which write its report in the same
  write, however it ends (`buildSubagentReport`), read from its transcript as it stands. A subagent
  never waits, since nobody answers it. Its run held one of its member's five slots, so the oldest
  run waiting for one is promoted once it has ended.

  A subagent's run at one of its limits before its fourth run chains instead (`chain`): it ends
  `CHAINED` and the next run is queued in the same write, holding its slot, so nothing is promoted,
  and its member's stop, read first, ends it stopped rather than lost on a run it never named.
  Answers `chained` then, for the worker to queue the next run, and `ended` otherwise
*/
async function endConversationRun({
  ending,
  fence,
  lease,
  position,
  isSubagent,
  chain = null,
}: EndConversationRunInput): Promise<'ended' | 'chained'> {
  const write = <T>(operation: () => Promise<T>) => (lease ? lease.write(operation) : operation())

  if (isSubagent) return endSubagentRun({ ending, fence, position, write, chain })

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

    return 'ended'
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

    return 'ended'
  }

  if (ending.kind === 'finished') {
    await write(() =>
      finishConversationRun(dataConnect, {
        ...fence,
        status: ending.status,
        ...(ending.usage ? { usage: ending.usage } : {}),
      }),
    )

    return 'ended'
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

  return 'ended'
}

type EndSubagentRunInput = Omit<EndConversationRunInput, 'lease' | 'isSubagent'> & {
  write: <T>(operation: () => Promise<T>) => Promise<T>
}

/*
  Ends a subagent's run as its worker decided, with its report, in one write, then promotes into the
  slot it held, or chains it at its limits, unless its member asked it to stop, when it ends stopped
*/
async function endSubagentRun(input: EndSubagentRunInput): Promise<'ended' | 'chained'> {
  const { ending, fence, chain, write } = input

  if (chain && fence && ending.kind === 'noted' && ending.isAtLimit) {
    const { data } = await getConversationRunStop(dataConnect, toReference(fence))

    if (!data.conversationRuns[0]?.stopRequestedAt) {
      await write(() =>
        chainSubagentRun(dataConnect, {
          ...fence,
          runNumber: chain.runNumber,
          anchorPosition: chain.anchorPosition,
          nextRunId: deriveChainedRunId(fence.runId),
          nextRunNumber: chain.runNumber + 1,
          failure: ending.failure,
          ...(ending.usage ? { usage: ending.usage } : {}),
          ...(chain.pendingToolResults ? { pendingToolResults: chain.pendingToolResults } : {}),
        }),
      )

      return 'chained'
    }

    await writeSubagentEnding({
      ...input,
      ending: {
        kind: 'noted',
        status: ConversationRunStatus.STOPPED,
        noteKind: ConversationNoteKind.STOPPED,
        failure: `Its member asked it to stop as it reached a limit: ${ending.failure}`,
        usage: ending.usage,
      },
    })
  } else {
    await writeSubagentEnding(input)
  }

  // The ending needs one of the two, without which it throws before
  const run = ending.kind === 'interrupted' ? ending.reference : fence

  if (run) await promoteFreedSlot(run)

  return 'ended'
}

async function writeSubagentEnding({ ending, fence, position, write }: EndSubagentRunInput) {
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

// The run's keys alone, which a read takes
function toReference({ organizationId, userId, conversationId, runId }: ConversationRunReference) {
  return { organizationId, userId, conversationId, runId }
}

// Promotes into the slot a subagent's run held until it ended. A promotion that fails leaves the
// slot to the reconcile and the sweep, never failing the end, which is written
async function promoteFreedSlot({ organizationId, userId, runId }: ConversationRunReference) {
  try {
    await promoteSubagentRuns({ organizationId, userId })
  } catch (error) {
    logger.warn(`Subagent run ${runId}: the slot it freed could not be promoted into`, error)
  }
}

export default endConversationRun
