import { SquareIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useStopConversationSubagent from '~hooks/conversation/useStopConversationSubagent'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The conversation that launched it, through which it is stopped
  conversationId: string
  subagentId: string
  title: string
  className?: string
}

/*
  Stop, on a subagent at work, its row's and its viewer's. It stays disabled once the stop went
  through, until the live list says the subagent is stopping and the button goes, and says so when
  the stop did not go through, which can be asked again
*/
function ConversationSubagentStop({ conversationId, subagentId, title, className }: Props) {
  const { formatMessage } = useIntl()
  const stopConversationSubagent = useStopConversationSubagent()
  const [isStopping, setIsStopping] = useState(false)

  async function stop() {
    setIsStopping(true)

    try {
      await stopConversationSubagent({ conversationId, subagentId })
    } catch (error) {
      console.error('The subagent could not be stopped', error)

      toast.error(formatMessage(conversationMessages.subagentStopError))
      setIsStopping(false)
    }
  }

  return (
    <Button
      variant="transparent"
      size="sm"
      icon={isStopping ? <Spinner tone="current" /> : <SquareIcon className="fill-current" />}
      aria-label={formatMessage(conversationMessages.subagentStopLabel, { title })}
      className={className}
      disabled={isStopping}
      onClick={stop}
    >
      {formatMessage(conversationMessages.subagentStop)}
    </Button>
  )
}

export default ConversationSubagentStop
