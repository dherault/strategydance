import { type RefObject, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import {
  ConversationApprovalState,
  ConversationMessageKind,
  ConversationNoteKind,
  ConversationRunStatus,
  ConversationToolStatus,
  OrganizationRole,
} from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import type {
  Conversation,
  ConversationMessageAttachment,
  ConversationMessageBody,
  ConversationRun,
  ConversationThreadEntry,
} from '~types'

import useNow from '~hooks/common/useNow'
import useConversationDeletedItems from '~hooks/conversation/useConversationDeletedItems'
import useConversationDocuments from '~hooks/conversation/useConversationDocuments'
import useConversationPendingMessages from '~hooks/conversation/useConversationPendingMessages'
import useConversationSubagents from '~hooks/conversation/useConversationSubagents'
import useConversationTasks from '~hooks/conversation/useConversationTasks'
import useConversationThread from '~hooks/conversation/useConversationThread'
import useConversationThreadScroll from '~hooks/conversation/useConversationThreadScroll'
import useMarkConversationRead from '~hooks/conversation/useMarkConversationRead'
import useReconcileConversationRun from '~hooks/conversation/useReconcileConversationRun'
import useIntegrationConnections from '~hooks/integration/useIntegrationConnections'
import useOrganizationIntegrations from '~hooks/integration/useOrganizationIntegrations'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import canRestoreConversationItem from '~utils/conversation/canRestoreConversationItem'
import findConversationSubagent from '~utils/conversation/findConversationSubagent'
import getConversationIntegrationIssue from '~utils/conversation/getConversationIntegrationIssue'
import getConversationThinkingStart from '~utils/conversation/getConversationThinkingStart'
import getConversationToolLabel from '~utils/conversation/getConversationToolLabel'
import groupConversationReplies from '~utils/conversation/groupConversationReplies'
import hasConversationMessageBody, {
  CALL_INTEGRATION_TOOL_NAME,
  LAUNCH_SUBAGENT_TOOL_NAME,
} from '~utils/conversation/hasConversationMessageBody'
import isAwaitingConversationRun, { type StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'
import isConversationRunGoing from '~utils/conversation/isConversationRunGoing'
import needsConversationDocuments, { DELETE_DOCUMENT_TOOL_NAME } from '~utils/conversation/needsConversationDocuments'
import needsConversationTasks, { DELETE_TASK_TOOL_NAME } from '~utils/conversation/needsConversationTasks'
import placeConversationPendingMessages from '~utils/conversation/placeConversationPendingMessages'
import readConversationDeletedCallIds from '~utils/conversation/readConversationDeletedCallIds'
import readConversationViewport from '~utils/conversation/readConversationViewport'

import Spinner from '~components/common/Spinner'
import ConversationAgentMessage from '~components/conversation/ConversationAgentMessage'
import ConversationApproval from '~components/conversation/ConversationApproval'
import ConversationAspectsNote from '~components/conversation/ConversationAspectsNote'
import ConversationBrief from '~components/conversation/ConversationBrief'
import ConversationDocumentRestore from '~components/conversation/ConversationDocumentRestore'
import ConversationIntegrationIssue from '~components/conversation/ConversationIntegrationIssue'
import ConversationMemberMessage from '~components/conversation/ConversationMemberMessage'
import ConversationMessagePlaceholder from '~components/conversation/ConversationMessagePlaceholder'
import ConversationNote from '~components/conversation/ConversationNote'
import ConversationNoteActions from '~components/conversation/ConversationNoteActions'
import ConversationQuestion from '~components/conversation/ConversationQuestion'
import ConversationSources from '~components/conversation/ConversationSources'
import ConversationSubagentCall from '~components/conversation/ConversationSubagentCall'
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
  // The run the reader last started from the page, and what records it, which a subagent's thread,
  // read only, has none of
  startedRun?: StartedConversationRun | null
  onRunStart?: (startedRun: StartedConversationRun) => void
  // Opens a subagent's work, where the thread is drawn somewhere that can show it
  onViewSubagent?: (subagentId: string) => void
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
  caught up. The questions of the turn the conversation waits on are answered in place, and so are
  its calls waiting for the reader's approval, and a run waiting on them all answered is reconciled
  too, in case its last answer could not carry it on. A call to an integration is named by its
  server, with the strip under it when that server does not work for the reader now, the
  organization's servers and the reader's accounts read only while the thread holds such a call. A
  launch is drawn as the subagent it launched, live, once the conversation's subagents and the
  call's body are read, and as the call it was until then. A subagent's own thread, which its viewer
  draws, is read only: its run is reconciled through its parent's page, it offers no Resume or Retry,
  and its notes speak of a subagent. The
  note that ends the latest response, when it is the last entry and nothing goes,
  offers Resume and Retry as its kind allows. Older entries load as the reader scrolls up
  to them, and each message's words land after its row, a placeholder line standing in meanwhile.
  The replies it shows are marked read once the latest is drawn whole.

  An observer does not fire again while what it watches stays in view, so once a page lands with
  the top still showing, the next one is asked for here. That reads where the top is rather than
  what the observer said last, which it says after the page has moved the top away
*/
function ConversationThread({
  conversation,
  run,
  startedRun = null,
  onRunStart = () => {},
  onViewSubagent,
  scrollerRef,
  size = 'md',
}: Props) {
  const intl = useIntl()
  // A subagent's, which the reader follows and never acts in
  const isReadOnly = conversation.parentId !== null
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
  // Read only once the conversation launched one, which every launch's row and the page then share
  const subagents = useConversationSubagents(conversation.id, { isEnabled: conversation.subagentCount > 0 })
  // One clock for every row that offers Restore until its day is up
  const now = useNow()

  const latest = entries.find(({ id }) => id === conversation.previewMessageId)
  const isLatestShown = latest ? !hasConversationMessageBody(latest) || bodies.has(latest.id) : false
  // The questions and approvals the reader has not answered
  const waitingEntries = entries.filter(
    ({ kind, answeredAt, isAnswerSkipped }) =>
      (kind === ConversationMessageKind.QUESTION || kind === ConversationMessageKind.APPROVAL)
      && !answeredAt
      && !isAnswerSkipped,
  )
  // The run the conversation waits on for the answers to its questions and approvals, while it does
  const waitingRunId = conversation.isAwaitingAnswer && run?.status === ConversationRunStatus.WAITING ? run.id : null
  const isIntegrationsNeeded = entries.some(isIntegrationEntry)
  const { role } = useCurrentOrganization()
  const integrations = useOrganizationIntegrations({ isEnabled: isIntegrationsNeeded })
  const connections = useIntegrationConnections({ isEnabled: isIntegrationsNeeded })
  // What a strip is told from: none is drawn before both lists are read, or when either could not be
  const isIntegrationsRead =
    isIntegrationsNeeded
    && !integrations.initialLoading
    && !connections.initialLoading
    && !integrations.hasFailed
    && !connections.hasFailed

  // The messages the reader sent that the tail does not hold yet, drawn at its foot, and those the
  // thread no longer needs
  const { shown: shownPendingMessages, needless: needlessPendingMessages } = placeConversationPendingMessages(
    pendingMessages,
    entries,
    bodies,
  )
  // Those it no longer needs, once no send goes: until then a failure can put the one going back, and
  // the composer counts its files among those the next message may hold. Joined, so the effect below
  // runs when they change
  const needlessPendingMessageIds = isSending ? '' : needlessPendingMessages.map(({ id }) => id).join()

  const forgetNeedlessPendingMessages = useEffectEvent((ids: string[]) => forgetPendingMessages(ids))

  useEffect(() => {
    if (needlessPendingMessageIds) forgetNeedlessPendingMessages(needlessPendingMessageIds.split(','))
  }, [needlessPendingMessageIds])

  useConversationThreadScroll(listRef, scrollerRef)
  useMarkConversationRead(conversation, isLatestShown)
  // A subagent's runs are reconciled through its parent's page, whose route its own refuses
  useReconcileConversationRun(conversation.id, isReadOnly ? null : run, !waitingEntries.length)

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
  const openSubagent = openToolCall ? readSubagent(openToolCall) : undefined
  const isWorking = isConversationRunGoing(run)
  const isAwaiting = isAwaitingConversationRun(startedRun, run)
  const runningCall = entries.findLast(
    ({ kind, toolStatus }) =>
      (kind === ConversationMessageKind.TOOL_CALL || kind === ConversationMessageKind.APPROVAL)
      && toolStatus === ConversationToolStatus.RUNNING,
  )

  function getStep() {
    if (run?.stopRequestedAt) return formatMessage(conversationMessages.stopping)
    if (run?.step) return run.step

    if (runningCall?.toolName) {
      return getConversationToolLabel(
        intl,
        runningCall.toolName,
        ConversationToolStatus.RUNNING,
        bodies.get(runningCall.id)?.integrationName,
      )
    }

    return null
  }

  // Whether the entry before the one at an index draws as a call's row, which a call's row sits closer to
  function isAfterCallRow(index: number) {
    const previous = entries[index - 1]

    return previous ? isCallRow(previous) : false
  }

  // The server and tool a call to an integration names, from its body
  function readIntegration(body: ConversationMessageBody | undefined) {
    return body?.integrationName && body.integrationToolName
      ? { name: body.integrationName, toolName: body.integrationToolName }
      : undefined
  }

  // The subagent a launch's row draws, once its body and the subagents are read
  function readSubagent(entry: ConversationThreadEntry) {
    if (entry.toolName !== LAUNCH_SUBAGENT_TOOL_NAME) return undefined

    return findConversationSubagent(subagents.data, bodies.get(entry.id)?.toolUseId)
  }

  // The strip under a call to a server that does not work for the reader now
  function renderIssue(body: ConversationMessageBody | undefined) {
    if (!body?.integrationName || !isIntegrationsRead) return null

    const issue = getConversationIntegrationIssue(body.integration?.id, integrations.data, connections.data)

    if (!issue) return null

    return (
      <ConversationIntegrationIssue
        issue={issue}
        integrationId={body.integration?.id ?? null}
        integrationName={body.integrationName}
        isAdministrator={role === OrganizationRole.ADMINISTRATOR}
      />
    )
  }

  // Resume and Retry, under the note that ends the latest response, while it is the last entry and
  // nothing goes
  function renderNoteActions(entry: ConversationThreadEntry) {
    const runId = entry.run?.id

    if (
      isReadOnly
      || !runId
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
      case ConversationMessageKind.TOOL_CALL: {
        const subagent = readSubagent(entry)

        if (subagent) {
          return (
            <ConversationSubagentCall
              conversationId={conversation.id}
              subagent={subagent}
              onOpen={() => setOpenToolCall(entry)}
              onView={onViewSubagent ? () => onViewSubagent(subagent.id) : undefined}
            />
          )
        }

        return (
          <ConversationToolCall
            toolName={entry.toolName ?? ''}
            status={entry.toolStatus ?? ConversationToolStatus.RUNNING}
            onOpen={() => setOpenToolCall(entry)}
            action={renderRestore(entry)}
            integration={readIntegration(body)}
            issue={renderIssue(body)}
          />
        )
      }
      case ConversationMessageKind.APPROVAL:
        if (!body) return <ConversationMessagePlaceholder />

        if (!entry.answeredAt) {
          return (
            <ConversationApproval
              conversationId={conversation.id}
              entry={entry}
              body={body}
              waitingRunId={waitingRunId}
              hasOtherWaiting={waitingEntries.some(({ id }) => id !== entry.id)}
              issue={renderIssue(body)}
              onRunStart={onRunStart}
            />
          )
        }

        // Decided, it is the call it became: allowed and waiting to run, run, or denied
        return (
          <ConversationToolCall
            toolName={entry.toolName ?? ''}
            status={entry.toolStatus ?? ConversationToolStatus.RUNNING}
            onOpen={() => setOpenToolCall(entry)}
            integration={readIntegration(body)}
            approval={
              entry.approvalState === ConversationApprovalState.DENIED
                ? 'denied'
                : entry.toolStatus
                  ? undefined
                  : 'allowed'
            }
            issue={renderIssue(body)}
          />
        )
      case ConversationMessageKind.QUESTION:
        return body ? (
          <ConversationQuestion
            conversationId={conversation.id}
            entry={entry}
            body={body}
            waitingRunId={waitingRunId}
            hasOtherWaiting={waitingEntries.some(({ id }) => id !== entry.id)}
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
      case ConversationMessageKind.BRIEF:
        return body ? (
          <ConversationBrief
            parentId={conversation.parentId ?? null}
            text={body.text ?? ''}
            attachmentIds={body.attachmentIds ?? []}
            documents={documents}
            tasks={tasks}
            size={size}
          />
        ) : (
          <ConversationMessagePlaceholder />
        )
      case ConversationMessageKind.NOTE:
        return entry.noteKind ? (
          <ConversationNote
            noteKind={entry.noteKind}
            actions={renderNoteActions(entry)}
            subject={isReadOnly ? 'subagent' : 'conversation'}
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
      isTight: (isCallRow(entry) && isAfterCallRow(index)) || !!replies.get(entry.id)?.isContinuation,
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
          integration={readIntegration(bodies.get(openToolCall.id))}
          subagent={
            openSubagent
              ? { conversationId: conversation.id, id: openSubagent.id, title: openSubagent.title }
              : undefined
          }
          onClose={() => setOpenToolCall(null)}
        />
      ) : null}
    </div>
  )
}

// Whether an entry is a call to an integration, whose server the thread reads the organization's list for
function isIntegrationEntry({ kind, toolName }: ConversationThreadEntry) {
  return (
    kind === ConversationMessageKind.APPROVAL
    || (kind === ConversationMessageKind.TOOL_CALL && toolName === CALL_INTEGRATION_TOOL_NAME)
  )
}

// Whether an entry draws as a call's row: a call, or an approval once it is decided
function isCallRow({ kind, answeredAt }: ConversationThreadEntry) {
  return (
    kind === ConversationMessageKind.TOOL_CALL || (kind === ConversationMessageKind.APPROVAL && Boolean(answeredAt))
  )
}

export default ConversationThread
