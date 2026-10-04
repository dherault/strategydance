import { CheckIcon, SkipForwardIcon } from 'lucide-react'
import { useId } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Checkbox } from 'strategydance-design-system/components/ui/Checkbox'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { Radio } from 'strategydance-design-system/components/ui/Radio'
import { cn } from 'strategydance-design-system/lib/utils'

import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  entry: ConversationThreadEntry
  body: ConversationMessageBody
}

/*
  A question Strategy Dance asked, with its options as radios, or checkboxes when several apply.

  Answered, the options chosen are ticked and the rest muted, and an answer in the reader's own
  words shows as one more option. Skipped, everything is muted. Waiting, it shows how to answer,
  every control off until answering arrives with the composer's questions
*/
function ConversationQuestion({ entry, body }: Props) {
  const { formatMessage } = useIntl()
  const promptId = useId()
  const name = useId()
  const options = body.questionOptions ?? []
  const isMultipleChoice = body.isMultipleChoice ?? false
  const Control = isMultipleChoice ? Checkbox : Radio
  const isSkipped = entry.isAnswerSkipped
  const isAnswered = !isSkipped && Boolean(entry.answeredAt)
  const isWaiting = !isSkipped && !isAnswered
  const selected = entry.answerSelected ?? []

  function renderEyebrow() {
    if (isWaiting) return formatMessage(conversationMessages.questionWaiting)

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
            <div key={option}>{renderAnsweredOption(option, isAnswered && selected.includes(option))}</div>
          ))}
          {isAnswered && entry.answerOther ? (
            <div>
              {renderAnsweredOption(entry.answerOther, true, formatMessage(conversationMessages.questionOwnAnswer))}
            </div>
          ) : null}
        </>
      )
    }

    return (
      <>
        {options.map(option => (
          <div key={option}>
            <Control
              name={name}
              label={option}
              disabled
            />
          </div>
        ))}
        <div className="flex items-center gap-2 opacity-50">
          <Control
            name={name}
            aria-label={formatMessage(conversationMessages.questionWriteOwn)}
            disabled
          />
          <Input
            placeholder={formatMessage(conversationMessages.questionWriteOwn)}
            aria-label={formatMessage(conversationMessages.questionOwnAnswer)}
            disabled
            className="h-8 min-w-0 flex-1 text-sm"
          />
        </div>
      </>
    )
  }

  return (
    <div
      role={isWaiting && !isMultipleChoice ? 'radiogroup' : 'group'}
      aria-labelledby={promptId}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-xs border bg-white px-3.5 pt-3.5 pb-3',
        isWaiting ? 'border-primary-200' : 'border-border',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase',
          isWaiting ? 'text-primary' : 'text-muted-foreground',
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
      {isWaiting ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled
          >
            {formatMessage(conversationMessages.questionSend)}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default ConversationQuestion
