import { useEffect, useState } from 'react'
import { type MessageDescriptor, useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import onboardingMessages from '~data/intl/messages/onboarding'

// After the right answer, in milliseconds: how long it shows before the screen fades out, and
// before the next one replaces it
const LEAVE_AT = 650
const DONE_AT = 1000

type Props = {
  // From 1
  index: number
  count: number
  question: MessageDescriptor
  answers: MessageDescriptor[]
  // The index of the answer that moves on
  correct: number
  onAnswered: () => void
}

/*
  One question of the quiz. A wrong answer turns red and leaves the others to try, since the only
  way on is the right one, which turns green and moves on by itself. Once it is picked nothing
  else can be, so a second click cannot turn it red again on its way out.

  The parent keys it by question, so each one starts with nothing picked
*/
function OnboardingQuestion({ index, count, question, answers, correct, onAnswered }: Props) {
  const { formatMessage } = useIntl()
  const [picked, setPicked] = useState<number | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)

  const isAnswered = picked === correct

  useEffect(() => {
    if (!isAnswered) return

    const timeouts = [
      setTimeout(() => setIsLeaving(true), LEAVE_AT),
      setTimeout(onAnswered, DONE_AT),
    ]

    return () => timeouts.forEach(clearTimeout)
  }, [isAnswered, onAnswered])

  function pick(answerIndex: number) {
    if (isAnswered) return

    setPicked(answerIndex)
  }

  return (
    <div
      className={cn(
        'flex w-full max-w-[640px] flex-col items-center gap-6 px-6 py-12 text-center ease-in-out',
        isLeaving
          ? 'animate-out fill-mode-forwards duration-350 fade-out slide-out-to-top-2'
          : 'animate-in duration-500 fade-in slide-in-from-bottom-2',
      )}
    >
      <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {formatMessage(onboardingMessages.questionCount, { index, count })}
      </p>
      <h1 className="m-0 text-5xl leading-[1.1] text-balance">
        {formatMessage(question)}
      </h1>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {answers.map((answer, answerIndex) => (
          <Button
            key={answer.id}
            variant="outline"
            size="lg"
            onClick={() => pick(answerIndex)}
            className={cn(
              'min-w-50',
              picked === answerIndex && (answerIndex === correct ? 'border-success text-success not-disabled:hover:border-success' : 'border-danger text-danger not-disabled:hover:border-danger'),
            )}
          >
            {formatMessage(answer)}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default OnboardingQuestion
