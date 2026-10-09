import { CheckIcon, SkipForwardIcon } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_ANSWER_OTHER_LENGTH, checkConversationAnswer } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Checkbox } from 'strategydance-design-system/components/ui/Checkbox'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { Radio } from 'strategydance-design-system/components/ui/Radio'
import { cn } from 'strategydance-design-system/lib/utils'

import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

import useAnswerConversationQuestion from '~hooks/conversation/useAnswerConversationQuestion'

import getConversationAnswerFailure, {
  type ConversationAnswerFailure,
} from '~utils/conversation/getConversationAnswerFailure'
import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
  entry: ConversationThreadEntry
  body: ConversationMessageBody
  // The run the conversation waits on, while it waits for this question's answer, and null otherwise
  waitingRunId: string | null
  // Whether another question of the same turn still waits, which answering this one leaves waiting
  hasOtherWaiting: boolean
  onRunStart: (startedRun: StartedConversationRun) => void
}

const NOTICE_MESSAGES = {
  conflict: conversationMessages.questionConflict,
  unavailable: conversationMessages.questionUnavailable,
  error: conversationMessages.questionError,
  queued: conversationMessages.questionQueued,
} as const

/*
  A question Strategy Dance asked, with its options as radios, or checkboxes when several apply,
  and a last option in the reader's own words, which typing in its field chooses.

  Waiting, while the conversation waits for it, the reader answers it: Send answer goes once the
  answer fits the question, as the backend checks it, and the run that carries the conversation on
  starts once every question of the turn is answered. One the response it belongs to was stopped or
  cut off before, which a resume makes answerable again, shows its options off. Answered, the
  options chosen are ticked and the rest muted, and an answer in the reader's own words shows as one
  more option. Skipped, everything is muted
*/
function ConversationQuestion({ conversationId, entry, body, waitingRunId, hasOtherWaiting, onRunStart }: Props) {
  const { formatMessage } = useIntl()
  const answerConversationQuestion = useAnswerConversationQuestion()
  const promptId = useId()
  const name = useId()
  const [selected, setSelected] = useState<string[]>([])
  const [isOtherChosen, setIsOtherChosen] = useState(false)
  const [other, setOther] = useState('')
  const [isSending, setIsSending] = useState(false)
  /*
    What sending the answer came to when it did not start a run: a failure, or an answer kept that
    the conversation goes on from later, the reader having runs going elsewhere. Each is said while
    the conversation still waits on the run it was sent to, and goes once the live data moves on
  */
  const [notice, setNotice] = useState<{
    kind: ConversationAnswerFailure | 'queued'
    waitingRunId: string
  } | null>(null)
  const options = body.questionOptions ?? []
  const isMultipleChoice = body.isMultipleChoice ?? false
  const Control = isMultipleChoice ? Checkbox : Radio
  const isSkipped = entry.isAnswerSkipped
  const isAnswered = !isSkipped && Boolean(entry.answeredAt)
  const isWaiting = !isSkipped && !isAnswered
  const isAnswerable = isWaiting && waitingRunId !== null
  const answer = { selected, other: isOtherChosen ? other : null }
  const canSend =
    isAnswerable && !isSending && checkConversationAnswer({ options, isMultipleChoice }, answer).outcome === 'valid'
  const answeredOptions = entry.answerSelected ?? []

  function choose(option: string, isChecked: boolean) {
    if (!isMultipleChoice) {
      setSelected([option])
      setIsOtherChosen(false)

      return
    }

    setSelected(current =>
      isChecked
        ? options.filter(candidate => candidate === option || current.includes(candidate))
        : current.filter(candidate => candidate !== option),
    )
  }

  function chooseOther(isChecked: boolean) {
    setIsOtherChosen(isChecked)

    if (isChecked && !isMultipleChoice) setSelected([])
  }

  function write(value: string) {
    setOther(value)

    if (value.trim() && !isOtherChosen) chooseOther(true)
  }

  async function send(event: FormEvent) {
    event.preventDefault()

    if (!canSend || !waitingRunId) return

    setIsSending(true)
    setNotice(null)

    try {
      const { runId } = await answerConversationQuestion({ conversationId, messageId: entry.id, answer })

      if (runId) onRunStart({ runId, previousRunId: waitingRunId })
      else if (!hasOtherWaiting) setNotice({ kind: 'queued', waitingRunId })
    } catch (error) {
      console.error('The answer could not be sent', error)

      setNotice({ kind: getConversationAnswerFailure(error), waitingRunId })
    } finally {
      setIsSending(false)
    }
  }

  function renderEyebrow() {
    if (isAnswerable) return formatMessage(conversationMessages.questionWaiting)
    if (isWaiting) return formatMessage(conversationMessages.questionUnanswered)

    return (
      <>
        {isSkipped ? <SkipForwardIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
        {formatMessage(isSkipped ? conversationMessages.questionSkipped : conversationMessages.questionAnswered)}
      </>
    )
  }

  // Answered, an option reads as chosen or not, and nothing can be changed. Off as a control, for
  // assistive technology as for a pointer, without the dimming a row that is off takes
  function renderAnsweredOption(option: string, isChosen: boolean, hint?: string) {
    return (
      <Control
        name={name}
        checked={isChosen}
        disabled
        className="has-disabled:cursor-default has-disabled:opacity-100"
        label={<span className={isChosen ? 'text-secondary' : 'font-normal text-muted-foreground'}>{option}</span>}
        hint={hint}
      />
    )
  }

  function renderOptions() {
    if (!isWaiting) {
      return (
        <>
          {options.map(option => (
            <div key={option}>{renderAnsweredOption(option, isAnswered && answeredOptions.includes(option))}</div>
          ))}
          {isAnswered && entry.answerOther ? (
            <div>
              {renderAnsweredOption(entry.answerOther, true, formatMessage(conversationMessages.questionOwnAnswer))}
            </div>
          ) : null}
        </>
      )
    }

    const isOff = !isAnswerable || isSending

    return (
      <>
        {options.map(option => (
          <div key={option}>
            <Control
              name={name}
              label={option}
              checked={selected.includes(option)}
              disabled={isOff}
              onChange={event => choose(option, event.target.checked)}
            />
          </div>
        ))}
        <div className={cn('flex items-center gap-2', !isAnswerable && 'opacity-50')}>
          <Control
            name={name}
            aria-label={formatMessage(conversationMessages.questionWriteOwn)}
            checked={isOtherChosen}
            disabled={isOff}
            onChange={event => chooseOther(event.target.checked)}
          />
          <Input
            placeholder={formatMessage(conversationMessages.questionWriteOwn)}
            aria-label={formatMessage(conversationMessages.questionOwnAnswer)}
            value={other}
            // Two code units a character at most, as `maxLength` counts them: the answer's check
            // holds the words to their 500 characters
            maxLength={MAX_ANSWER_OTHER_LENGTH * 2}
            disabled={isOff}
            onChange={event => write(event.target.value)}
            className="h-8 min-w-0 flex-1 text-sm"
          />
        </div>
      </>
    )
  }

  function renderNotice() {
    if (!notice || notice.waitingRunId !== waitingRunId) return null

    const isFailure = notice.kind !== 'queued'

    return (
      <p
        role={isFailure ? 'alert' : 'status'}
        className={cn('m-0 text-xs', isFailure ? 'text-danger' : 'text-muted-foreground')}
      >
        {formatMessage(NOTICE_MESSAGES[notice.kind])}
      </p>
    )
  }

  return (
    <form
      role={isWaiting && !isMultipleChoice ? 'radiogroup' : 'group'}
      aria-labelledby={promptId}
      onSubmit={send}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-xs border bg-white px-3.5 pt-3.5 pb-3',
        isAnswerable ? 'border-primary-200' : 'border-border',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase',
          isAnswerable ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {renderEyebrow()}
      </span>
      <p
        id={promptId}
        className={cn(
          '-mt-1 mb-0 text-base leading-[1.45] font-semibold text-pretty wrap-anywhere',
          isSkipped ? 'text-muted-foreground' : 'text-secondary',
        )}
      >
        {body.questionPrompt}
      </p>
      {isWaiting ? (
        <p className="-mt-2 mb-0 text-xs text-muted-foreground">
          {formatMessage(
            isMultipleChoice ? conversationMessages.questionSelectAll : conversationMessages.questionSelectOne,
          )}
        </p>
      ) : null}
      <div className="flex flex-col gap-2.5">{renderOptions()}</div>
      {renderNotice()}
      {isAnswerable ? (
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            icon={isSending ? <Spinner tone="current" /> : undefined}
            disabled={!canSend}
          >
            {formatMessage(conversationMessages.questionSend)}
          </Button>
        </div>
      ) : null}
    </form>
  )
}

export default ConversationQuestion
