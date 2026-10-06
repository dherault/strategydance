import { ArrowUpIcon } from 'lucide-react'
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useRef, useState } from 'react'
import { type MessageDescriptor, useIntl } from 'react-intl'
import { MAX_CONVERSATION_MESSAGE_LENGTH, MAX_CONVERSATION_MESSAGES, MAX_CONVERSATIONS } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'

import type { Conversation, ConversationRun } from '~types'

import useSendConversationMessage from '~hooks/conversation/useSendConversationMessage'

import createId from '~utils/common/createId'
import getConversationSendFailure, {
  type ConversationSendFailure,
} from '~utils/conversation/getConversationSendFailure'
import isAwaitingConversationRun, { type StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'
import isConversationRunGoing from '~utils/conversation/isConversationRunGoing'
import isConversationSendKey from '~utils/conversation/isConversationSendKey'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

const FAILURE_MESSAGES = {
  busy: conversationMessages.composerBusy,
  full: conversationMessages.noteFull,
  tooMany: conversationMessages.tooMany,
  unavailable: conversationMessages.composerUnavailable,
  error: conversationMessages.composerError,
} satisfies Record<ConversationSendFailure, MessageDescriptor>

// The send that failed, kept so that sending the same words again is the same send
type FailedSend = {
  messageId: string
  text: string
}

type Props = {
  conversationId: string
  // The conversation, or null for a draft, which the first message stores
  conversation: Conversation | null
  // Its latest run, or null before its first
  run: ConversationRun | null
}

/*
  Where the reader writes to Strategy Dance, at the foot of a conversation: a field that grows
  with what is written, and a button that sends it. Text only for now: stopping a run, mentions
  and attachments come later.

  Nothing is sent while a run goes, nor once the conversation is full, though the reader can
  write meanwhile. The run a send started counts as going from the moment the backend answers,
  before the page's live read of it lands, so a second send never races it. A send that fails keeps its words in the field, and says why. Sending the same
  words again sends them under the same message's id, so a send that did reach the backend, and
  only lost its answer, is stored once. Words changed since are a new message, with an id of its
  own, rather than a retry the backend would answer with the first words.

  It is the last thing on its page, so a draft keeps it, and what is written in it, when its first
  message stores it
*/
function ConversationComposer({ conversationId, conversation, run }: Props) {
  const { formatMessage } = useIntl()
  const sendConversationMessage = useSendConversationMessage()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [failure, setFailure] = useState<ConversationSendFailure | null>(null)
  const [failedSend, setFailedSend] = useState<FailedSend | null>(null)
  const [startedRun, setStartedRun] = useState<StartedConversationRun | null>(null)

  const trimmedText = text.trim()
  const isFull = conversation ? conversation.isFull || conversation.messageCount >= MAX_CONVERSATION_MESSAGES : false
  const isRunGoing = isConversationRunGoing(run) || isAwaitingConversationRun(startedRun, run)
  const canSend = !!trimmedText && !isSending && !isRunGoing && !isFull
  const shownFailure = isFull ? 'full' : failure

  async function send() {
    if (!canSend) return

    const sentValue = text
    const messageId = failedSend?.text === trimmedText ? failedSend.messageId : createId()
    const previousRunId = run?.id ?? null

    setIsSending(true)
    setFailure(null)

    try {
      const { runId } = await sendConversationMessage({ conversationId, messageId, text: trimmedText })

      // What was written while it went is the reader's next message
      setText(current => (current === sentValue ? '' : current))
      setFailedSend(null)
      setStartedRun({ runId, previousRunId })
      textareaRef.current?.focus()
      // The thread follows what lands while the reader is at its foot, their own message included
      window.scrollTo({ top: document.documentElement.scrollHeight })
    } catch (error) {
      console.error('The message could not be sent', error)

      setFailedSend({ messageId, text: trimmedText })
      setFailure(getConversationSendFailure(error))
    } finally {
      setIsSending(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send()
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value)
    setFailure(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!isConversationSendKey(event.nativeEvent, window.matchMedia('(pointer: coarse)').matches)) return

    event.preventDefault()
    send()
  }

  return (
    <form
      className="sticky bottom-0 flex flex-col gap-2 bg-background pt-3 pb-5"
      onSubmit={handleSubmit}
    >
      {shownFailure ? (
        <p
          role="alert"
          className="m-0 text-sm text-danger"
        >
          {formatMessage(FAILURE_MESSAGES[shownFailure], { max: MAX_CONVERSATIONS })}
        </p>
      ) : null}
      <div className="flex items-end gap-1.5">
        <Textarea
          ref={textareaRef}
          autosize
          rows={1}
          maxRows={7}
          value={text}
          maxLength={MAX_CONVERSATION_MESSAGE_LENGTH}
          placeholder={formatMessage(conversationMessages.composerPlaceholder)}
          aria-label={formatMessage(conversationMessages.composerLabel)}
          // A draft has nothing else to do but be written in
          autoFocus={!conversation}
          className="min-h-8 px-2.5 py-[5px] text-sm/5"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="submit"
          size="sm"
          icon={isSending ? <Spinner tone="current" /> : <ArrowUpIcon />}
          aria-label={formatMessage(conversationMessages.composerSend)}
          disabled={!canSend}
          // Keeps the field focused, so a touch screen keeps its keyboard up for the next message
          onMouseDown={event => event.preventDefault()}
        />
      </div>
    </form>
  )
}

export default ConversationComposer
