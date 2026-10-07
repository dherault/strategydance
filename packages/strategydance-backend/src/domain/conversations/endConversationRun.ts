import { buildConversationPreview } from 'strategydance-core'
import {
  ConversationNoteKind,
  type ConversationRunStatus,
  finishConversationRun,
  finishConversationRunWithNote,
  interruptConversationRun,
} from 'strategydance-database/backend'

import type { ConversationRunFence, ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import type { ConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'

/*
  How a worker ends its run:

  - `finished`: completed, or stopped in a conversation deleted meanwhile, without a note
  - `noted`: with a note the thread draws, such as a run at a limit that sends no further request,
    or one whose next request would not fit Claude's context, which marks its conversation full
  - `interrupted`: its author is no longer the member it was queued under, fenced on the run alone,
    at the attempt the worker read or claimed, with the note saying so
*/
export type ConversationRunEnding =
  | {
      kind: 'finished'
      status: ConversationRunStatus.COMPLETED | ConversationRunStatus.STOPPED
      usage?: ConversationRunUsage
    }
  | {
      kind: 'noted'
      status: ConversationRunStatus.FAILED
      noteKind: ConversationNoteKind.FAILED | ConversationNoteKind.FULL
      usage?: ConversationRunUsage
      isFull?: boolean
    }
  | { kind: 'interrupted'; reference: ConversationRunReference; attempts: number }

type EndConversationRunInput = {
  ending: ConversationRunEnding
  // The worker's fence and its lease, which a worker that has not claimed its run yet has neither of
  fence: ConversationRunFence | null
  lease: ConversationRunLease | null
  // The conversation's counter, where a note goes
  position: number
}

/*
  Ends a run as its worker decided, in one write, which settles its usage ledger when the worker
  holds one. A note's id derives from the run, which has one at most, so a route that finalizes the
  same run meanwhile and the worker never both add theirs. A note at a counter something moved
  meanwhile is refused, and the worker reads again and retries
*/
async function endConversationRun({ ending, fence, lease, position }: EndConversationRunInput) {
  const write = <T>(operation: () => Promise<T>) => (lease ? lease.write(operation) : operation())

  if (ending.kind === 'interrupted') {
    await write(() =>
      interruptConversationRun(dataConnect, {
        ...ending.reference,
        attempts: ending.attempts,
        noteId: deriveConversationMessageId(ending.reference.runId, 'note'),
        position,
        preview: buildConversationPreview({ kind: 'NOTE', noteKind: ConversationNoteKind.INTERRUPTED }),
      }),
    )

    return
  }

  if (!fence) throw new Error('A run ends as its worker decides only once it is claimed')

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
      ...(ending.usage ? { usage: ending.usage } : {}),
      ...(ending.isFull ? { isFull: true } : {}),
    }),
  )
}

export default endConversationRun
