import { ArrowUpIcon, SquareIcon } from 'lucide-react'
import { type ChangeEvent, type FormEvent, type KeyboardEvent, type RefObject, useRef, useState } from 'react'
import { type MessageDescriptor, useIntl } from 'react-intl'
import { MAX_CONVERSATION_MESSAGE_LENGTH, MAX_CONVERSATION_MESSAGES, MAX_CONVERSATIONS } from 'strategydance-core'
import type { CompanyAspect } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Conversation, ConversationRun } from '~types'

import useConversationComposerDraft from '~hooks/conversation/useConversationComposerDraft'
import useConversationMentions from '~hooks/conversation/useConversationMentions'
import useSendConversationMessage from '~hooks/conversation/useSendConversationMessage'
import useStopConversationRun from '~hooks/conversation/useStopConversationRun'

import createId from '~utils/common/createId'
import getConversationSendFailure, {
  type ConversationSendFailure,
} from '~utils/conversation/getConversationSendFailure'
import isAwaitingConversationRun, { type StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'
import isConversationRunGoing from '~utils/conversation/isConversationRunGoing'
import isConversationSendKey from '~utils/conversation/isConversationSendKey'
import scrollConversationToEnd from '~utils/conversation/scrollConversationToEnd'

import Spinner from '~components/common/Spinner'
import ConversationComposerMenu from '~components/conversation/ConversationComposerMenu'
import ConversationMentionList from '~components/conversation/ConversationMentionList'

import conversationMessages from '~data/intl/messages/conversation'

const FAILURE_MESSAGES = {
  busy: conversationMessages.composerBusy,
  full: conversationMessages.noteFull,
  tooMany: conversationMessages.tooMany,
  unavailable: conversationMessages.composerUnavailable,
  error: conversationMessages.composerError,
} satisfies Record<ConversationSendFailure, MessageDescriptor>

type Props = {
  conversationId: string
  // The conversation, or null for a draft, which the first message stores
  conversation: Conversation | null
  // Its latest run, or null before its first
  run: ConversationRun | null
  // The run the reader last started from the page, and what records it
  startedRun: StartedConversationRun | null
  onRunStart: (startedRun: StartedConversationRun | null) => void
  // The aspects the reader picked on a draft, which its first message sends
  draftAspects: CompanyAspect[]
  // At the foot of the conversation's page, or of a dock's window
  variant?: 'page' | 'dock'
  // The box the thread scrolls in, in a dock's window, or none on the page, where the window scrolls
  scrollerRef?: RefObject<HTMLElement | null>
  // Whether the field takes the focus as it appears: a draft's by default, which has nothing else to
  // do but be written in
  isAutoFocused?: boolean
}

/*
  Where the reader writes to Strategy Dance, at the foot of a conversation: a field that grows
  with what is written, and a button that sends it. Typing `@`, or "Mention knowledge" in the "+"
  menu, suggests knowledge to mention, and each mention picked is sent as a link to its document
  (`useConversationMentions`). Attachments come later.

  Nothing is sent while a run goes, nor once the conversation is full, though the reader can
  write meanwhile. A first send's run counts as going from the moment the backend answers, before
  the page's live read of it lands, so a second send never races it. While a run goes, Stop takes
  the place of Send, and once the reader asked, in this tab or another, it waits for the run to
  end.

  A send that fails keeps its words in the field, and says why. Sending the same message again
  sends it under the same message's id, so a send that did reach the backend, and only lost its
  answer, is stored once. A message changed since, its words or the documents it mentions, is a new
  message, with an id of its own, rather than a retry the backend would answer with the first one.
  A message whose mentions take it past what a message may hold, though its words fit the field,
  is not sent, and says so. A retry's answer is not waited on: it can name the
  run the first send started, older than one another tab has started since, which the read would
  never move on from. Only a message's first send is sure to start a run newer than any read

  It is the last thing on its page, or in its dock's window, so a draft keeps it, and what is written
  in it, when its first message stores it. That message carries the aspects the reader picked on the
  draft, and no later one does.

  The message, its mentions and where its send stands live in `conversationComposerDrafts` rather
  than in the composer, shared for the life of the tab by every composer that draws the
  conversation: moving it between its page and the dock, or minimizing its window, loses none of it,
  a send going in one is going in all, and a send that failed is sent again under its id from
  wherever the reader sends it
*/
function ConversationComposer({
  conversationId,
  conversation,
  run,
  startedRun,
  onRunStart,
  draftAspects,
  variant = 'page',
  scrollerRef,
  isAutoFocused = !conversation,
}: Props) {
  const { formatMessage } = useIntl()
  const sendConversationMessage = useSendConversationMessage()
  const stopConversationRun = useStopConversationRun()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // The message being written and its send, shared by every composer that draws the conversation,
  // and what changes it there, should this composer have gone meanwhile
  const [draft, changeDraft] = useConversationComposerDraft(conversationId)

  const mentions = useConversationMentions(textareaRef, draft.mentions, change =>
    changeDraft(current => ({ mentions: change(current.mentions) })),
  )
  const [stoppingRunId, setStoppingRunId] = useState<string | null>(null)
  const [failedStopRunId, setFailedStopRunId] = useState<string | null>(null)

  const { text, failedSend, failure } = draft
  const isSending = draft.sendingMessageId !== null
  const trimmedText = text.trim()
  const sentText = mentions.serialize(trimmedText)
  const isTooLong = sentText.length > MAX_CONVERSATION_MESSAGE_LENGTH
  const isFull = conversation ? conversation.isFull || conversation.messageCount >= MAX_CONVERSATION_MESSAGES : false
  const isAwaiting = isAwaitingConversationRun(startedRun, run)
  const isRunGoing = isConversationRunGoing(run) || isAwaiting
  const canSend = !!trimmedText && !isSending && !isRunGoing && !isFull && !isTooLong
  // The run Stop stops: the one going, or the one the reader just started, before the read shows it
  const goingRunId = isAwaiting ? (startedRun?.runId ?? null) : isConversationRunGoing(run) ? (run?.id ?? null) : null
  const isStopping =
    goingRunId !== null && (stoppingRunId === goingRunId || (run?.id === goingRunId && !!run.stopRequestedAt))
  const shownFailure = isFull ? 'full' : failure

  async function send() {
    if (!canSend) return

    const sentValue = text
    const sentMentions = draft.mentions
    const isRetry = failedSend?.text === sentText
    const messageId = isRetry ? failedSend.messageId : createId()
    const previousRunId = run?.id ?? null

    changeDraft(() => ({ sendingMessageId: messageId, failure: null }))

    try {
      const { runId } = await sendConversationMessage({
        conversationId,
        messageId,
        text: sentText,
        // A draft's aspects as the reader holds them now, a retry's too: a first send the backend
        // never stored takes the latest pick, and one it did store brings its conversation in,
        // whose head then shows the aspects stored. Resending the first pick would drop the latest
        // in the first case, and a new message's id would store the same words twice in the second
        aspects: conversation ? [] : draftAspects,
      })

      // What was written while it went, its words or a mention picked over words left as they were,
      // is the reader's next message, which stays: only the message as it was sent is cleared
      let isSentAsWritten = false

      changeDraft(current => {
        isSentAsWritten = current.text === sentValue && current.mentions === sentMentions

        return {
          sendingMessageId: null,
          failedSend: null,
          ...(isSentAsWritten ? { text: '', mentions: new Map() } : {}),
        }
      })

      if (isSentAsWritten) mentions.reset()

      onRunStart(isRetry ? null : { runId, previousRunId })

      // Unless the reader has left the page while it went, for one this must not move
      const textarea = textareaRef.current

      if (textarea) {
        textarea.focus()
        // The thread follows what lands while the reader is at its foot, their own message included
        scrollConversationToEnd(scrollerRef?.current ?? null)
      }
    } catch (error) {
      console.error('The message could not be sent', error)

      changeDraft(() => ({
        sendingMessageId: null,
        failedSend: { messageId, text: sentText },
        failure: getConversationSendFailure(error),
      }))
    }
  }

  async function stop() {
    if (!goingRunId || isStopping) return

    setStoppingRunId(goingRunId)
    setFailedStopRunId(null)

    try {
      await stopConversationRun({ conversationId, runId: goingRunId })
    } catch (error) {
      console.error('The response could not be stopped', error)

      setStoppingRunId(null)
      setFailedStopRunId(goingRunId)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send()
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const { value } = event.target

    changeDraft(() => ({ text: value, failure: null }))
    mentions.detect()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentions.handleKeyDown(event)) return
    if (!isConversationSendKey(event.nativeEvent, window.matchMedia('(pointer: coarse)').matches)) return

    event.preventDefault()
    send()
  }

  return (
    <form
      className={cn(
        'flex flex-col gap-2 bg-background',
        // Above the page's bar on a phone, which the list of knowledge to mention can reach
        variant === 'page' ? 'sticky bottom-0 z-10 pt-3 pb-5' : 'border-t border-border px-3 pt-2.5 pb-3',
      )}
      onSubmit={handleSubmit}
    >
      {mentions.isListShown ? (
        <ConversationMentionList
          listId={mentions.listId}
          getOptionId={mentions.getOptionId}
          documents={mentions.matches}
          highlightedIndex={mentions.highlightedIndex}
          query={mentions.query ?? ''}
          onHighlight={mentions.highlight}
          onPick={mentions.pick}
        />
      ) : null}
      {shownFailure ? (
        <p
          role="alert"
          className="m-0 text-sm text-danger"
        >
          {formatMessage(FAILURE_MESSAGES[shownFailure], { max: MAX_CONVERSATIONS })}
        </p>
      ) : null}
      {isTooLong ? (
        <p
          role="alert"
          className="m-0 text-sm text-danger"
        >
          {formatMessage(conversationMessages.composerTooLong)}
        </p>
      ) : null}
      {goingRunId !== null && failedStopRunId === goingRunId ? (
        <p
          role="alert"
          className="m-0 text-sm text-danger"
        >
          {formatMessage(conversationMessages.composerStopError)}
        </p>
      ) : null}
      <div className="flex items-end gap-1.5">
        <ConversationComposerMenu onMentionKnowledge={mentions.insertTrigger} />
        <Textarea
          ref={textareaRef}
          autosize
          rows={1}
          maxRows={7}
          value={text}
          maxLength={MAX_CONVERSATION_MESSAGE_LENGTH}
          placeholder={formatMessage(conversationMessages.composerPlaceholder)}
          aria-label={formatMessage(conversationMessages.composerLabel)}
          aria-autocomplete="list"
          aria-controls={mentions.matches.length ? mentions.listId : undefined}
          aria-activedescendant={mentions.matches.length ? mentions.getOptionId(mentions.highlightedIndex) : undefined}
          autoFocus={isAutoFocused}
          className="min-h-8 px-2.5 py-[5px] text-sm/5"
          onFocus={mentions.enable}
          onChange={handleChange}
          onSelect={mentions.detect}
          onKeyDown={handleKeyDown}
          onBlur={mentions.close}
        />
        {isRunGoing ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={isStopping ? <Spinner tone="current" /> : <SquareIcon className="fill-current" />}
            aria-label={formatMessage(conversationMessages.composerStop)}
            disabled={isStopping}
            onMouseDown={event => event.preventDefault()}
            onClick={stop}
          />
        ) : (
          <Button
            type="submit"
            size="sm"
            icon={isSending ? <Spinner tone="current" /> : <ArrowUpIcon />}
            aria-label={formatMessage(conversationMessages.composerSend)}
            disabled={!canSend}
            // Keeps the field focused, so a touch screen keeps its keyboard up for the next message
            onMouseDown={event => event.preventDefault()}
          />
        )}
      </div>
    </form>
  )
}

export default ConversationComposer
