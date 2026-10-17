import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpIcon, SquareIcon } from 'lucide-react'
import {
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useRef,
  useState,
} from 'react'
import { type MessageDescriptor, useIntl } from 'react-intl'
import {
  MAX_CONVERSATION_ATTACHMENT_SIZE,
  MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE,
  MAX_CONVERSATION_IMAGE_DIMENSION,
  MAX_CONVERSATION_IMAGE_SIZE,
  MAX_CONVERSATION_MESSAGE_LENGTH,
  MAX_CONVERSATION_MESSAGES,
  MAX_CONVERSATION_PDF_PAGES,
  MAX_CONVERSATION_TEXT_ATTACHMENT_LENGTH,
  MAX_CONVERSATIONS,
  MAX_PENDING_CONVERSATION_ATTACHMENTS,
} from 'strategydance-core'
import type { CompanyAspect } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Conversation, ConversationRun } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useConversationComposerAttachments from '~hooks/conversation/useConversationComposerAttachments'
import useConversationComposerDraft from '~hooks/conversation/useConversationComposerDraft'
import useConversationMentions from '~hooks/conversation/useConversationMentions'
import useSendConversationMessage from '~hooks/conversation/useSendConversationMessage'
import useStopConversationRun from '~hooks/conversation/useStopConversationRun'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import createId from '~utils/common/createId'
import getConversationAttachmentQueryKey from '~utils/conversation/getConversationAttachmentQueryKey'
import getConversationSendFailure, {
  type ConversationSendFailure,
} from '~utils/conversation/getConversationSendFailure'
import getConversationSendStartedRun from '~utils/conversation/getConversationSendStartedRun'
import isAwaitingConversationRun, { type StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'
import isConversationRunGoing from '~utils/conversation/isConversationRunGoing'
import isConversationSendKey from '~utils/conversation/isConversationSendKey'
import readConversationPastedFiles from '~utils/conversation/readConversationPastedFiles'
import restoreConversationFailedSend from '~utils/conversation/restoreConversationFailedSend'
import scrollConversationToEnd from '~utils/conversation/scrollConversationToEnd'

import Spinner from '~components/common/Spinner'
import ConversationComposerMenu from '~components/conversation/ConversationComposerMenu'
import ConversationComposerTray from '~components/conversation/ConversationComposerTray'
import ConversationMentionList from '~components/conversation/ConversationMentionList'
import ConversationSubagentsStrip from '~components/conversation/ConversationSubagentsStrip'

import type { ConversationAttachmentRefusal } from '~data/conversationComposerDrafts'
import conversationMessages from '~data/intl/messages/conversation'

const FAILURE_MESSAGES = {
  busy: conversationMessages.composerBusy,
  full: conversationMessages.noteFull,
  tooMany: conversationMessages.tooMany,
  overBudget: conversationMessages.composerOverBudget,
  filesGone: conversationMessages.composerFilesGone,
  unavailable: conversationMessages.composerUnavailable,
  error: conversationMessages.composerError,
} satisfies Record<ConversationSendFailure, MessageDescriptor>

const REFUSAL_MESSAGES = {
  unsupported: conversationMessages.composerAttachmentUnsupported,
  tooLarge: conversationMessages.composerAttachmentTooLarge,
  imageTooLarge: conversationMessages.composerImageTooLarge,
  empty: conversationMessages.composerAttachmentEmpty,
  pending: conversationMessages.composerAttachmentsPending,
  perMessage: conversationMessages.composerAttachmentsPerMessage,
} satisfies Record<ConversationAttachmentRefusal['kind'], MessageDescriptor>

// The numbers the refusals name, each reading those it needs
const REFUSAL_VALUES = {
  megabytes: MAX_CONVERSATION_ATTACHMENT_SIZE / (1024 * 1024),
  imageMegabytes: MAX_CONVERSATION_IMAGE_SIZE / (1024 * 1024),
  pixels: MAX_CONVERSATION_IMAGE_DIMENSION,
  pages: MAX_CONVERSATION_PDF_PAGES,
  characters: MAX_CONVERSATION_TEXT_ATTACHMENT_LENGTH,
}

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
  (`useConversationMentions`). "Files and images" in the same menu, or a paste of files without
  text, attaches files, which go up at once and wait in the tray above the field
  (`useConversationComposerAttachments`): a message may hold files and no words, and is sent once
  every file it holds is up.

  A message sent leaves the field for the thread at once, which draws it, Strategy Dance thinking
  under it, while its send goes and until the live read brings it in (`pendingMessages`), so the
  reader never waits to see it. Nothing is sent while a send or a run goes, nor once the
  conversation is full, though the reader can write meanwhile. A first send's run counts as going
  from the moment the backend answers, before the page's live read of it lands, so a second send
  never races it. From the send on, Stop takes the place of Send, though it stops nothing before the
  backend has answered with the run, and once the reader asked, in this tab or another, it waits for
  the run to end.

  A send that fails takes its message out of the thread and puts it back, its words in the field and
  its files in the tray, ahead of anything written meanwhile, and says why. Sending the same
  message again sends it under the same message's id, so a send that did reach the
  backend, and only lost its answer, is stored once. A message changed since, its words, the
  documents it mentions or its files, is a new message, with an id of its own, rather than a retry
  the backend would answer with the first one. Files the backend no longer holds ready, as after
  they waited two days, go up again by themselves, under new ids, for the reader to send again.
  A message whose mentions take it past what a message may hold, though its words fit the field,
  is not sent, and says so. A retry's run counts as going only while the read still shows the run
  it showed when the message was first sent (`getConversationSendStartedRun`): once the read has
  moved on, the retry can name the run the first send started, older than one another tab has
  started since, which the read would never move on from

  It is the last thing on its page, or in its dock's window, so a draft keeps it, and what is written
  in it, when its first message stores it. That message carries the aspects the reader picked on the
  draft, and no later one does.

  The message, its mentions, its files and where its send stands live in `conversationComposerDrafts` rather
  than in the composer, shared for the life of the tab by every composer that draws the
  conversation: moving it between its page and the dock, or minimizing its window, loses none of it,
  a send going in one is going in all, and a send that failed is sent again under its id from
  wherever the reader sends it.

  Above it all, the strip that says how many of the conversation's subagents still work, with Stop
  all, and how many of their reports wait for the next message (`ConversationSubagentsStrip`)
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
  const queryClient = useQueryClient()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const sendConversationMessage = useSendConversationMessage()
  const stopConversationRun = useStopConversationRun()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // The message being written and its send, shared by every composer that draws the conversation,
  // and what changes it there, should this composer have gone meanwhile
  const [draft, changeDraft] = useConversationComposerDraft(conversationId)
  const attachments = useConversationComposerAttachments(conversationId)

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
  const hasFiles = attachments.attachments.length > 0
  const areFilesReady = attachments.attachments.every(({ status }) => status === 'ready')
  const hasFailedFiles = attachments.attachments.some(({ status }) => status === 'failed')
  const isFull = conversation ? conversation.isFull || conversation.messageCount >= MAX_CONVERSATION_MESSAGES : false
  const isAwaiting = isAwaitingConversationRun(startedRun, run)
  const isRunGoing = isConversationRunGoing(run) || isAwaiting
  const canSend = (!!trimmedText || hasFiles) && areFilesReady && !isSending && !isRunGoing && !isFull && !isTooLong
  // The run Stop stops: the one going, or the one the reader just started, before the read shows it
  const goingRunId = isAwaiting ? (startedRun?.runId ?? null) : isConversationRunGoing(run) ? (run?.id ?? null) : null
  const isStopping =
    goingRunId !== null && (stoppingRunId === goingRunId || (run?.id === goingRunId && !!run.stopRequestedAt))
  const shownFailure = isFull ? 'full' : failure

  async function send() {
    if (!canSend) return

    const sentValue = text
    const sentMentions = draft.mentions
    const sentAttachments = attachments.attachments
    const sentAttachmentIds = sentAttachments.map(({ id }) => id)
    const isRetry = failedSend?.text === sentText && failedSend.attachmentIds.join() === sentAttachmentIds.join()
    const messageId = isRetry ? failedSend.messageId : createId()
    const previousRunId = run?.id ?? null
    const sentAt = new Date().toISOString()

    // The images sent are drawn in the thread from the bytes that went up, rather than read back:
    // left in the cache before the message is drawn there, as it is at once
    for (const { id, contentType, file } of sentAttachments) {
      if (!contentType.startsWith('image/')) continue

      queryClient.setQueryData(
        getConversationAttachmentQueryKey(organization?.id ?? null, conversationId, id, viewer?.uid ?? null),
        file,
      )
    }

    // The message leaves the field for the thread at once, which draws it while it goes
    changeDraft(current => ({
      text: '',
      mentions: new Map(),
      attachments: [],
      attachmentRefusal: null,
      sendingMessageId: messageId,
      pendingMessages: [
        ...current.pendingMessages.filter(({ id }) => id !== messageId),
        {
          id: messageId,
          text: sentText,
          attachments: sentAttachments.map(({ id, name, contentType, file }) => ({
            id,
            name,
            contentType,
            size: file.size,
          })),
          sentAt,
          position: conversation?.nextMessagePosition ?? 0,
        },
      ],
      failure: null,
    }))
    mentions.reset()
    textareaRef.current?.focus()

    // The thread takes the reader to their message, wherever they had scrolled to, once it is drawn,
    // unless they have left the page meanwhile, for one this must not move
    requestAnimationFrame(() => {
      if (textareaRef.current) scrollConversationToEnd(scrollerRef?.current ?? null)
    })

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
        attachmentIds: sentAttachmentIds,
      })

      // The run is recorded before the send stops going, so no composer drawing the conversation
      // ever sees neither going, and lets a second send race it
      onRunStart(
        getConversationSendStartedRun({
          runId,
          previousRunId,
          firstPreviousRunId: isRetry ? failedSend.previousRunId : undefined,
          startedAt: sentAt,
        }),
      )
      // The message stays in the thread until the live read brings it in, which may come after
      changeDraft(() => ({ sendingMessageId: null, failedSend: null }))
    } catch (error) {
      console.error('The message could not be sent', error)

      const failure = getConversationSendFailure(error, sentAttachmentIds.length > 0)

      // The message leaves the thread for the field again, to be sent again
      changeDraft(current => ({
        ...restoreConversationFailedSend(
          { text: sentValue, mentions: sentMentions, attachments: sentAttachments },
          current,
        ),
        sendingMessageId: null,
        pendingMessages: current.pendingMessages.filter(({ id }) => id !== messageId),
        failedSend: {
          messageId,
          text: sentText,
          attachmentIds: sentAttachmentIds,
          // The first send's, which a run any later send is answered with is newer than
          previousRunId: isRetry ? failedSend.previousRunId : previousRunId,
        },
        failure,
      }))

      if (failure === 'filesGone') attachments.retry(sentAttachmentIds)
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

  // Files pasted without text are attached, rather than pasted as nothing
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = readConversationPastedFiles(event.clipboardData)

    if (!files.length || isFull) return

    event.preventDefault()
    attachFiles(files)
  }

  // Unless the conversation is full, which would never send them, though they took places among the
  // reader's unsent files
  function attachFiles(files: File[]) {
    if (isFull) return

    attachments.add(files)
    changeDraft(() => ({ failure: null }))
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
      {conversation ? (
        <ConversationSubagentsStrip
          conversation={conversation}
          run={run}
          variant={variant}
        />
      ) : null}
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
      {attachments.refusal ? (
        <p
          role="alert"
          className="m-0 text-sm text-danger"
        >
          {formatMessage(REFUSAL_MESSAGES[attachments.refusal.kind], {
            name: attachments.refusal.name,
            max:
              attachments.refusal.kind === 'pending'
                ? MAX_PENDING_CONVERSATION_ATTACHMENTS
                : MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE,
            ...REFUSAL_VALUES,
          })}
        </p>
      ) : null}
      {hasFailedFiles ? (
        <p
          role="alert"
          className="m-0 text-sm text-danger"
        >
          {formatMessage(conversationMessages.composerAttachmentsFailed)}
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
      {hasFiles ? (
        <ConversationComposerTray
          attachments={attachments.attachments}
          onRemove={id => {
            attachments.remove(id)
            changeDraft(() => ({ failure: null }))
          }}
          onRetry={id => attachments.retry([id])}
        />
      ) : null}
      <div className="flex items-end gap-1.5">
        <ConversationComposerMenu
          onMentionKnowledge={mentions.insertTrigger}
          // The field again once the picker closes, but on a touch screen, which would raise its
          // keyboard over the files just picked
          onFilesOpen={() => {
            if (!window.matchMedia('(pointer: coarse)').matches) textareaRef.current?.focus()
          }}
          onFilesPick={attachFiles}
          canAttachFiles={!isFull}
        />
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
          onPaste={handlePaste}
          onBlur={mentions.close}
        />
        {isRunGoing || isSending ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={isStopping ? <Spinner tone="current" /> : <SquareIcon className="fill-current" />}
            aria-label={formatMessage(conversationMessages.composerStop)}
            // Until the backend has answered with the run the send started, which is what it stops
            disabled={isStopping || !goingRunId}
            onMouseDown={event => event.preventDefault()}
            onClick={stop}
          />
        ) : (
          <Button
            type="submit"
            size="sm"
            icon={<ArrowUpIcon />}
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
