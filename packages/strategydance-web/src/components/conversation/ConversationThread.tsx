import { useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { ConversationMessageKind, ConversationRunStatus, ConversationToolStatus } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Conversation, ConversationRun, ConversationThreadEntry } from '~types'

import useConversationThread from '~hooks/conversation/useConversationThread'
import useConversationThreadScroll from '~hooks/conversation/useConversationThreadScroll'
import useMarkConversationRead from '~hooks/conversation/useMarkConversationRead'

import getConversationToolLabel from '~utils/conversation/getConversationToolLabel'
import hasConversationMessageBody from '~utils/conversation/hasConversationMessageBody'

import Spinner from '~components/common/Spinner'
import ConversationAgentMessage from '~components/conversation/ConversationAgentMessage'
import ConversationAspectsNote from '~components/conversation/ConversationAspectsNote'
import ConversationMemberMessage from '~components/conversation/ConversationMemberMessage'
import ConversationMessagePlaceholder from '~components/conversation/ConversationMessagePlaceholder'
import ConversationNote from '~components/conversation/ConversationNote'
import ConversationQuestion from '~components/conversation/ConversationQuestion'
import ConversationThinking from '~components/conversation/ConversationThinking'
import ConversationToolCall from '~components/conversation/ConversationToolCall'
import ConversationToolCallDialog from '~components/conversation/ConversationToolCallDialog'

import conversationMessages from '~data/intl/messages/conversation'

// How far above the window an older page starts loading, so it is there before the reader is
const OLDER_MARGIN_PX = 400

type Props = {
  conversation: Conversation
  // The conversation's latest run, or null before its first
  run: ConversationRun | null
}

/*
  A conversation's thread, read-only: each entry as the design draws its kind, oldest first, and
  the thinking indicator after them while a run goes. Older entries load as the reader scrolls up
  to them, and each message's words land after its row, a placeholder line standing in meanwhile.
  The replies it shows are marked read once the latest is drawn whole.

  An observer does not fire again while what it watches stays in view, so once a page lands with
  the top still showing, the next one is asked for here. That reads where the top is rather than
  what the observer said last, which it says after the page has moved the top away
*/
function ConversationThread({ conversation, run }: Props) {
  const intl = useIntl()
  const { formatMessage } = intl
  const { entries, bodies, hasOlder, olderStatus, isFilling, loadOlder } = useConversationThread(conversation)
  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [openToolCall, setOpenToolCall] = useState<ConversationThreadEntry | null>(null)

  const latest = entries.find(({ id }) => id === conversation.previewMessageId)
  const isLatestShown = latest ? !hasConversationMessageBody(latest.kind) || bodies.has(latest.id) : false

  useConversationThreadScroll(listRef)
  useMarkConversationRead(conversation, isLatestShown)

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([observed]) => {
        if (observed?.isIntersecting) loadOlder()
      },
      { rootMargin: `${OLDER_MARGIN_PX}px 0px 0px 0px` },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasOlder, loadOlder])

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (olderStatus !== 'idle' || !hasOlder || !sentinel) return

    const { top, bottom } = sentinel.getBoundingClientRect()

    if (bottom >= -OLDER_MARGIN_PX && top <= window.innerHeight) loadOlder()
  }, [olderStatus, hasOlder, entries, loadOlder])

  const isWorking = run?.status === ConversationRunStatus.QUEUED || run?.status === ConversationRunStatus.RUNNING
  const runningCall = entries.findLast(
    ({ kind, toolStatus }) =>
      kind === ConversationMessageKind.TOOL_CALL && toolStatus === ConversationToolStatus.RUNNING,
  )

  function getStep() {
    if (run?.step) return run.step

    if (runningCall?.toolName) {
      return getConversationToolLabel(intl, runningCall.toolName, ConversationToolStatus.RUNNING)
    }

    return null
  }

  function renderEntry(entry: ConversationThreadEntry) {
    const body = bodies.get(entry.id)

    switch (entry.kind) {
      case ConversationMessageKind.MEMBER_TEXT:
        return body ? <ConversationMemberMessage text={body.text ?? ''} /> : <ConversationMessagePlaceholder isMember />
      case ConversationMessageKind.AGENT_TEXT:
        return body ? <ConversationAgentMessage text={body.text ?? ''} /> : <ConversationMessagePlaceholder />
      case ConversationMessageKind.TOOL_CALL:
        return (
          <ConversationToolCall
            toolName={entry.toolName ?? ''}
            status={entry.toolStatus ?? ConversationToolStatus.RUNNING}
            onOpen={() => setOpenToolCall(entry)}
          />
        )
      case ConversationMessageKind.QUESTION:
        return body ? (
          <ConversationQuestion
            entry={entry}
            body={body}
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
        return entry.noteKind ? <ConversationNote noteKind={entry.noteKind} /> : null
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

  return (
    <div className="flex flex-col pt-2 pb-10 [overflow-anchor:none]">
      {renderOlder()}
      <div
        ref={listRef}
        role="log"
        aria-label={formatMessage(conversationMessages.threadLabel)}
        aria-busy={olderStatus === 'loading' || isFilling}
        className="flex flex-col gap-4"
      >
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            data-entry-id={entry.id}
            className={cn(
              'flex min-w-0 flex-col',
              // Consecutive calls sit closer together, as one stretch of work
              entry.kind === ConversationMessageKind.TOOL_CALL
                && entries[index - 1]?.kind === ConversationMessageKind.TOOL_CALL
                && '-mt-2',
            )}
          >
            {renderEntry(entry)}
          </div>
        ))}
        {isWorking && run ? (
          <ConversationThinking
            step={getStep()}
            startedAt={run.createdAt}
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
