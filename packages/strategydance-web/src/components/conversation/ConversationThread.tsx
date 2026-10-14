import { type RefObject, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import {
  ConversationMessageKind,
  ConversationNoteKind,
  ConversationRunStatus,
  ConversationToolStatus,
} from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Conversation, ConversationMessageAttachment, ConversationRun, ConversationThreadEntry } from '~types'

import useNow from '~hooks/common/useNow'
import useConversationDeletedItems from '~hooks/conversation/useConversationDeletedItems'
import useConversationDocuments from '~hooks/conversation/useConversationDocuments'
import useConversationPendingMessages from '~hooks/conversation/useConversationPendingMessages'
import useConversationTasks from '~hooks/conversation/useConversationTasks'
import useConversationThread from '~hooks/conversation/useConversationThread'
import useConversationThreadScroll from '~hooks/conversation/useConversationThreadScroll'
import useMarkConversationRead from '~hooks/conversation/useMarkConversationRead'
import useReconcileConversationRun from '~hooks/conversation/useReconcileConversationRun'

import canRestoreConversationItem from '~utils/conversation/canRestoreConversationItem'
import getConversationThinkingStart from '~utils/conversation/getConversationThinkingStart'
import getConversationToolLabel from '~utils/conversation/getConversationToolLabel'
import groupConversationReplies from '~utils/conversation/groupConversationReplies'
import hasConversationMessageBody from '~utils/conversation/hasConversationMessageBody'
import isAwaitingConversationRun, { type StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'
import isConversationRunGoing from '~utils/conversation/isConversationRunGoing'
import needsConversationDocuments, { DELETE_DOCUMENT_TOOL_NAME } from '~utils/conversation/needsConversationDocuments'
import needsConversationTasks, { DELETE_TASK_TOOL_NAME } from '~utils/conversation/needsConversationTasks'
import readConversationDeletedCallIds from '~utils/conversation/readConversationDeletedCallIds'
import readConversationViewport from '~utils/conversation/readConversationViewport'

import Spinner from '~components/common/Spinner'
import ConversationAgentMessage from '~components/conversation/ConversationAgentMessage'
import ConversationAspectsNote from '~components/conversation/ConversationAspectsNote'
import ConversationDocumentRestore from '~components/conversation/ConversationDocumentRestore'
import ConversationMemberMessage from '~components/conversation/ConversationMemberMessage'
import ConversationMessagePlaceholder from '~components/conversation/ConversationMessagePlaceholder'
import ConversationNote from '~components/conversation/ConversationNote'
import ConversationNoteActions from '~components/conversation/ConversationNoteActions'
import ConversationQuestion from '~components/conversation/ConversationQuestion'
import ConversationSources from '~components/conversation/ConversationSources'
import ConversationTaskRestore from '~components/conversation/ConversationTaskRestore'
import ConversationThinking from '~components/conversation/ConversationThinking'
import ConversationToolCall from '~components/conversation/ConversationToolCall'
import ConversationToolCallDialog from '~components/conversation/ConversationToolCallDialog'

import conversationMessages from '~data/intl/messages/conversation'

// How far above what the reader sees an older page starts loading, so it is there before the reader is
const OLDER_MARGIN_PX = 400

type Props = {
  conversation: Conversation
  // The conversation's latest run, or null before its first
  run: ConversationRun | null
  // The run the reader last started from the page, and what records it
  startedRun: StartedConversationRun | null
  onRunStart: (startedRun: StartedConversationRun) => void
  // The box the thread scrolls in, in a dock's window, or none on the page, where the window scrolls
  scrollerRef?: RefObject<HTMLElement | null>
  // Small in a dock's window, which is narrow
  size?: 'sm' | 'md'
}

/*
  A conversation's thread: each entry as the design draws its kind, oldest first, and the thinking
  indicator after them while a run goes, until its lease passes, when the backend is asked to
  reconcile it. The message the reader sends is drawn at its foot the moment they send it, and in
  place of its body until that is read (`pendingMessages`), and the thinking indicator shows from the
  same moment, as it does from any run the reader starts, before the read of the latest run has
  caught up. The questions of the turn the conversation waits on are answered in place, and a
  run waiting on questions all answered is reconciled too, in case its last answer could not carry
  it on. The note that ends the latest response, when it is the last entry and nothing goes,
  offers Resume and Retry as its kind allows. Older entries load as the reader scrolls up
  to them, and each message's words land after its row, a placeholder line standing in meanwhile.
  The replies it shows are marked read once the latest is drawn whole.

  An observer does not fire again while what it watches stays in view, so once a page lands with
  the top still showing, the next one is asked for here. That reads where the top is rather than
  what the observer said last, which it says after the page has moved the top away
*/
function ConversationThread({ conversation, run, startedRun, onRunStart, scrollerRef, size = 'md' }: Props) {
  const intl = useIntl()
  const { formatMessage } = intl
  const { entries, bodies, hasOlder, olderStatus, isFilling, loadOlder, dropRuns } = useConversationThread(conversation)
  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [openToolCall, setOpenToolCall] = useState<ConversationThreadEntry | null>(null)
  const { pendingMessages, isSending, sendingMessage, forgetPendingMessages } = useConversationPendingMessages(
    conversation.id,
  )
  // Read as the reader sends a mention too, the composer's read, so it is drawn linked from the start
  const documents = useConversationDocuments(
    needsConversationDocuments(entries, bodies) || pendingMessages.some(({ text }) => /doc:/i.test(text)),
  )
  const tasks = useConversationTasks(needsConversationTasks(entries, bodies))
  const deletedItems = useConversationDeletedItems(conversation.id, readConversationDeletedCallIds(entries))
  // One clock for every row that offers Restore until its day is up
  const now = useNow()

  const latest = entries.find(({ id }) => id === conversation.previewMessageId)
  const isLatestShown = latest ? !hasConversationMessageBody(latest.kind) || bodies.has(latest.id) : false
  const waitingQuestions = entries.filter(
    ({ kind, answeredAt, isAnswerSkipped }) =>
      kind === ConversationMessageKind.QUESTION && !answeredAt && !isAnswerSkipped,
  )
  // The run the conversation waits on for the answers to its questions, while it does
  const waitingRunId = conversation.isAwaitingAnswer && run?.status === ConversationRunStatus.WAITING ? run.id : null

  // The messages the reader sent that the tail does not hold yet, drawn at its foot
  const shownPendingMessages = pendingMessages.filter(({ id }) => !entries.some(entry => entry.id === id))
  // Those the thread holds with their bodies, which they are drawn from, once no send goes: until then
  // a failure can put the one going back, and the composer counts its files among those the next
  // message may hold. Joined, so the effect below runs when they change
  const heldPendingMessageIds = isSending
    ? ''
    : pendingMessages
        .filter(({ id }) => bodies.has(id))
        .map(({ id }) => id)
        .join()

  const forgetHeldPendingMessages = useEffectEvent((ids: string[]) => forgetPendingMessages(ids))

  useEffect(() => {
    if (heldPendingMessageIds) forgetHeldPendingMessages(heldPendingMessageIds.split(','))
  }, [heldPendingMessageIds])

  useConversationThreadScroll(listRef, scrollerRef)
  useMarkConversationRead(conversation, isLatestShown)
  useReconcileConversationRun(conversation.id, run, !waitingQuestions.length)

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([observed]) => {
        if (observed?.isIntersecting) loadOlder()
      },
      { root: scrollerRef?.current ?? null, rootMargin: `${OLDER_MARGIN_PX}px 0px 0px 0px` },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasOlder, loadOlder, scrollerRef])

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (olderStatus !== 'idle' || !hasOlder || !sentinel) return

    const { top, bottom } = sentinel.getBoundingClientRect()
    const viewport = readConversationViewport(scrollerRef?.current ?? null)

    if (bottom >= viewport.top - OLDER_MARGIN_PX && top <= viewport.bottom) loadOlder()
  }, [olderStatus, hasOlder, entries, loadOlder, scrollerRef])

  const replies = groupConversationReplies(entries, bodies)
  const isWorking = isConversationRunGoing(run)
  const isAwaiting = isAwaitingConversationRun(startedRun, run)
  const runningCall = entries.findLast(
    ({ kind, toolStatus }) =>
      kind === ConversationMessageKind.TOOL_CALL && toolStatus === ConversationToolStatus.RUNNING,
  )

  function getStep() {
    if (run?.stopRequestedAt) return formatMessage(conversationMessages.stopping)
    if (run?.step) return run.step

    if (runningCall?.toolName) {
      return getConversationToolLabel(intl, runningCall.toolName, ConversationToolStatus.RUNNING)
    }

    return null
  }

  // Resume and Retry, under the note that ends the latest response, while it is the last entry and
  // nothing goes
  function renderNoteActions(entry: ConversationThreadEntry) {
    const runId = entry.run?.id

    if (
      !runId
      || runId !== run?.id
      || entry.id !== entries.at(-1)?.id
      || shownPendingMessages.length
      || isWorking
      || isAwaiting
    ) {
      return null
    }

    return (
      <ConversationNoteActions
        key={runId}
        conversationId={conversation.id}
        runId={runId}
        canResume={
          entry.noteKind === ConversationNoteKind.STOPPED || entry.noteKind === ConversationNoteKind.INTERRUPTED
        }
        onRunStart={onRunStart}
        onRunsRemove={dropRuns}
      />
    )
  }

  /*
    Restore, on a row where Strategy Dance deleted a document or a task, while the organization's
    live list does not hold it and a day has not passed since the call. A row offers nothing else,
    so a phone keeps its badge while Restore is not shown
  */
  function renderRestore(entry: ConversationThreadEntry) {
    const deleted = entry.toolStatus === ConversationToolStatus.SUCCEEDED ? deletedItems.get(entry.id) : undefined

    if (!deleted) return null

    if (entry.toolName === DELETE_DOCUMENT_TOOL_NAME && canRestoreConversationItem(deleted, documents, now)) {
      return <ConversationDocumentRestore documentId={deleted.id} />
    }

    if (entry.toolName === DELETE_TASK_TOOL_NAME && canRestoreConversationItem(deleted, tasks, now)) {
      return <ConversationTaskRestore taskId={deleted.id} />
    }

    return null
  }

  function renderMemberMessage(text: string, attachments: readonly ConversationMessageAttachment[]) {
    return (
      <ConversationMemberMessage
        conversationId={conversation.id}
        text={text}
        attachments={attachments}
        documents={documents}
        size={size}
      />
    )
  }

  function renderEntry(entry: ConversationThreadEntry) {
    const body = bodies.get(entry.id)

    switch (entry.kind) {
      case ConversationMessageKind.MEMBER_TEXT: {
        if (body) return renderMemberMessage(body.text ?? '', body.conversationAttachments_on_message)

        // The reader's own message, just sent, is drawn as they sent it until its body is read
        const pending = pendingMessages.find(({ id }) => id === entry.id)

        return pending ? (
          renderMemberMessage(pending.text, pending.attachments)
        ) : (
          <ConversationMessagePlaceholder isMember />
        )
      }
      case ConversationMessageKind.AGENT_TEXT: {
        const piece = replies.get(entry.id)

        if (!body) return <ConversationMessagePlaceholder />

        return (
          <>
            <ConversationAgentMessage
              text={body.text ?? ''}
              markers={piece?.markers}
              sources={piece?.sources}
              documents={documents}
              tasks={tasks}
              size={size}
            />
            {piece?.isLast ? <ConversationSources sources={piece.sources} /> : null}
          </>
        )
      }
      case ConversationMessageKind.TOOL_CALL:
        return (
          <ConversationToolCall
            toolName={entry.toolName ?? ''}
            status={entry.toolStatus ?? ConversationToolStatus.RUNNING}
            onOpen={() => setOpenToolCall(entry)}
            action={renderRestore(entry)}
          />
        )
      case ConversationMessageKind.QUESTION:
        return body ? (
          <ConversationQuestion
            conversationId={conversation.id}
            entry={entry}
            body={body}
            waitingRunId={waitingRunId}
            hasOtherWaiting={waitingQuestions.some(({ id }) => id !== entry.id)}
            onRunStart={onRunStart}
          />
        ) : (
          <ConversationMessagePlaceholder />
        )
      case ConversationMessageKind.ASPECTS:
        return (
          <ConversationAspectsNote
            aspects={entry.aspects ?? []}
            setBy={entry.aspectsSetBy ?? null}
          />
        )
      case ConversationMessageKind.NOTE:
        return entry.noteKind ? (
          <ConversationNote
            noteKind={entry.noteKind}
            actions={renderNoteActions(entry)}
          />
        ) : null
      default:
        return null
    }
  }

  function renderOlder() {
    if (!hasOlder) return null

    return (
      <div
        ref={sentinelRef}
        className="flex min-h-8 items-center justify-center pb-4"
      >
        {olderStatus === 'loading' ? <Spinner /> : null}
        {olderStatus === 'failed' ? (
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            {formatMessage(conversationMessages.olderError)}
            <Button
              variant="outline"
              size="sm"
              onClick={loadOlder}
            >
              {formatMessage(conversationMessages.retry)}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  const rows = [
    ...entries.map((entry, index) => ({
      id: entry.id,
      content: renderEntry(entry),
      // Consecutive calls sit closer together, as one stretch of work, and a reply's pieces as the
      // paragraphs of one reply
      isTight:
        (entry.kind === ConversationMessageKind.TOOL_CALL
          && entries[index - 1]?.kind === ConversationMessageKind.TOOL_CALL)
        || !!replies.get(entry.id)?.isContinuation,
    })),
    // The messages just sent, under their own ids, so that each stays as it is drawn when its entry
    // takes its place
    ...shownPendingMessages.map(({ id, text, attachments }) => ({
      id,
      content: renderMemberMessage(text, attachments),
      isTight: false,
    })),
  ]

  return (
    <div className="flex grow flex-col py-2 [overflow-anchor:none]">
      {renderOlder()}
      <div
        ref={listRef}
        role="log"
        aria-label={formatMessage(conversationMessages.threadLabel)}
        aria-busy={olderStatus === 'loading' || isFilling}
        className="flex flex-col gap-4"
      >
        {rows.map(({ id, content, isTight }) => (
          <div
            key={id}
            data-entry-id={id}
            className={cn('flex min-w-0 flex-col', isTight && '-mt-2')}
          >
            {content}
          </div>
        ))}
        {isWorking || isSending || isAwaiting ? (
          <ConversationThinking
            step={isWorking ? getStep() : null}
            startedAt={getConversationThinkingStart({ run, isWorking, sendingMessage, startedRun, isAwaiting })}
          />
        ) : null}
      </div>
      {openToolCall ? (
        <ConversationToolCallDialog
          messageId={openToolCall.id}
          toolName={openToolCall.toolName ?? ''}
          status={openToolCall.toolStatus ?? ConversationToolStatus.SUCCEEDED}
          onClose={() => setOpenToolCall(null)}
        />
      ) : null}
    </div>
  )
}

export default ConversationThread
