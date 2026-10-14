import { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import { Logo } from 'strategydance-design-system/components/brand/Logo'

import getConversationElapsed from '~utils/conversation/getConversationElapsed'

import conversationMessages from '~data/intl/messages/conversation'

// How often the elapsed time moves on
const TICK_INTERVAL_MS = 1000

type Props = {
  // The progress line the run wrote, or what it is running, or null for neither
  step: string | null
  // When the time counts from (`getConversationThinkingStart`): when the reader sent the message
  // that starts the run, or for any other run, when it was queued, whether a worker has claimed it
  // yet or not. Null for a run started otherwise that the page has not read yet, which counts from
  // when the indicator appeared
  startedAt: string | null
}

/*
  Shown while Strategy Dance works on an answer: its mark pulsing, what it is doing shimmering, and
  how long it has gone on the right. It keeps its own one-second clock, since `useNow` ticks once a
  minute. It appears as the reader sends, before the run is read, and stays as it lands, counting
  from it from then on. Without motion when the reader asks for less
*/
function ConversationThinking({ step, startedAt }: Props) {
  const { formatMessage } = useIntl()
  const [now, setNow] = useState(() => Date.now())
  const [shownAt] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [])

  const label = step ?? formatMessage(conversationMessages.thinking)
  const elapsed = getConversationElapsed(now - (startedAt ? new Date(startedAt).getTime() : shownAt))

  function renderElapsed() {
    if (!elapsed) return null

    if (!elapsed.minutes) return formatMessage(conversationMessages.elapsedSeconds, { seconds: elapsed.seconds })

    return formatMessage(conversationMessages.elapsedMinutes, {
      minutes: elapsed.minutes,
      seconds: String(elapsed.seconds).padStart(2, '0'),
    })
  }

  return (
    <div
      role="status"
      aria-label={formatMessage(conversationMessages.working, { step: label })}
      className="flex min-h-6 items-center gap-2.5 text-sm"
    >
      <Logo className="size-4 flex-none animate-conversation-pulse text-secondary motion-reduce:animate-none" />
      <span
        key={label}
        aria-hidden="true"
        className="inline-block min-w-0 animate-conversation-step truncate bg-[linear-gradient(90deg,var(--color-neutral-500)_0_35%,var(--color-neutral-900)_50%,var(--color-neutral-500)_65%_100%)] bg-size-[250%_100%] bg-clip-text font-medium text-transparent motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-muted-foreground"
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className="ml-auto flex-none text-xs text-muted-foreground tabular-nums"
      >
        {renderElapsed()}
      </span>
    </div>
  )
}

export default ConversationThinking
