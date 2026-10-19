import { type ConversationPreview, buildConversationPreview } from 'strategydance-core'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  chainSubagentRun,
  finishConversationRun,
  finishConversationRunFull,
  finishConversationRunWaiting,
  finishConversationRunWithNote,
  finishSubagentRun,
  finishSubagentRunWithNote,
  getConversationRunStop,
  interruptConversationRun,
  interruptSubagentRun,
  SpendCeilingScope,
} from 'strategydance-database/backend'

import type { ConversationRunFence, ConversationRunReference, UsageCapScope } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import type { ConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'
import toConversationUsageVariables from '~domain/conversations/toConversationUsageVariables'
import buildSubagentReport from '~domain/subagents/buildSubagentReport'
import deriveChainedRunId from '~domain/subagents/deriveChainedRunId'
import promoteSubagentRuns from '~domain/subagents/promoteSubagentRuns'
import reactToSubagentReports from '~domain/subagents/reactToSubagentReports'
import startDueSubagentReactions from '~domain/subagents/startDueSubagentReactions'

/*
  How a worker ends its run:

  - `finished`: completed, or stopped in a conversation deleted meanwhile, without a note
  - `waiting`: on the questions its turn asked, until an answer or a send consumes the turn
  - `noted`: with a note the thread draws, and why, for the logs: failed, at a limit that sends no
    further request, which `isAtLimit` says, a daily spend ceiling among them, whose and when it has
    room again its note names (`ceiling`), or after Claude's API failed it, full when its next
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
      ceiling?: ConversationSpendCeilingEnding
    } & (
      | { status: ConversationRunStatus.FAILED; noteKind: ConversationNoteKind.FAILED | ConversationNoteKind.FULL }
      | { status: ConversationRunStatus.STOPPED; noteKind: ConversationNoteKind.STOPPED }
      | { status: ConversationRunStatus.REFUSED; noteKind: ConversationNoteKind.REFUSED }
    ))
  // With the preview of a call it cancels, when the preview shows it
  | { kind: 'waiting'; usage?: ConversationRunUsage; preview?: ConversationPreview | null }
  | { kind: 'interrupted'; reference: ConversationRunReference; attempts: number; failure: string }

// The daily spend ceiling a run failed at, whose and when it has room again, in RFC 3339, which its
// note names and which a subagent's run never chains past
export type ConversationSpendCeilingEnding = { scope: UsageCapScope; freesAt: string }

// The scope a note's ceiling is stored as
const CEILING_SCOPES: Record<UsageCapScope, SpendCeilingScope> = {
  member: SpendCeilingScope.MEMBER,
  account: SpendCeilingScope.ACCOUNT,
  organization: SpendCeilingScope.ORGANIZATION,
}

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
  // Whether the conversation is a subagent, whose run ends with its report, and its parent, whose
  // reaction its end may start
  isSubagent: boolean
  parentId?: string | null
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
  Answers `chained` then, for the worker to queue the next run, and `ended` otherwise.

  A run that ended may let a reaction to subagents' reports start: a subagent's end its parent's, the
  last report of a batch, or marks its report delivered when the parent is full; and any other run,
  which frees one of its member's 3, its own conversation's reaction first, when it completed, then
  the member's oldest due in the organization (`startDueSubagentReactions`). It ends a full
  conversation through `FinishConversationRunFull`, which marks the reports waiting delivered
*/
async function endConversationRun(input: EndConversationRunInput): Promise<'ended' | 'chained'> {
  const ended = await endRun(input)

  if (ended === 'ended') await reactAfter(input)

  return ended
}

async function endRun({
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
        ...toConversationUsageVariables(ending.usage),
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
        ...toConversationUsageVariables(ending.usage),
      }),
    )

    return 'ended'
  }

  const noted = {
    ...fence,
    noteId: deriveConversationMessageId(fence.runId, 'note'),
    position,
    preview: buildConversationPreview({ kind: 'NOTE', noteKind: ending.noteKind, ...toNoteCeiling(ending.ceiling) }),
    failure: ending.failure,
    ...toConversationUsageVariables(ending.usage),
    ...(ending.isFull ? { isFull: true } : {}),
  }

  // A full conversation is sent to no more, so the reports waiting are marked delivered as it ends
  if (ending.noteKind === ConversationNoteKind.FULL) {
    await write(() => finishConversationRunFull(dataConnect, noted))
  } else {
    await write(() =>
      finishConversationRunWithNote(dataConnect, {
        ...noted,
        status: ending.status,
        noteKind: ending.noteKind,
        ...toNoteCeiling(ending.ceiling),
      }),
    )
  }

  return 'ended'
}

/*
  What a run's end lets start, once it is written: a subagent's parent's reaction, and for any other
  run, its member's reactions due, its own conversation's first. One that fails is logged, and left
  to the parent's page, the next run's end or the sweep, never failing the end, which is written
*/
async function reactAfter({ ending, fence, isSubagent, parentId }: EndConversationRunInput) {
  const run = ending.kind === 'interrupted' ? ending.reference : fence

  if (!run) return

  const member = { organizationId: run.organizationId, userId: run.userId }

  try {
    if (isSubagent) {
      if (parentId) await reactToSubagentReports({ ...member, conversationId: parentId })
    } else {
      await startDueSubagentReactions(member, { first: run.conversationId })
    }
  } catch (error) {
    logger.warn(`Conversation run ${run.runId}: the reactions its end lets start could not be read`, error)
  }
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

  // A daily spend ceiling stops the subagent whole, as nothing it chains to could send a request
  if (chain && fence && ending.kind === 'noted' && ending.isAtLimit && !ending.ceiling) {
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
          ...toConversationUsageVariables(ending.usage),
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
        ...toConversationUsageVariables(ending.usage),
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
      preview: buildConversationPreview({ kind: 'NOTE', noteKind: ending.noteKind, ...toNoteCeiling(ending.ceiling) }),
      failure: ending.failure,
      ...toConversationUsageVariables(ending.usage),
      ...(ending.isFull ? { isFull: true } : {}),
      ...toNoteCeiling(ending.ceiling),
      report,
    }),
  )
}

// What a note stores of the daily spend ceiling its run failed at, and its preview names
function toNoteCeiling(ceiling: ConversationSpendCeilingEnding | undefined) {
  return ceiling ? { ceilingScope: CEILING_SCOPES[ceiling.scope], ceilingFreesAt: ceiling.freesAt } : {}
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
