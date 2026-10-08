import { PlayIcon, RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useResumeConversationRun from '~hooks/conversation/useResumeConversationRun'
import useRetryConversationRun from '~hooks/conversation/useRetryConversationRun'

import getConversationSendFailure, {
  type ConversationSendFailure,
} from '~utils/conversation/getConversationSendFailure'
import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
  // The run the note ended, the conversation's latest
  runId: string
  // Whether the run stopped or was interrupted, which Resume carries on
  canResume: boolean
  onRunStart: (startedRun: StartedConversationRun) => void
  // Drops from the thread the messages of the runs a Retry deleted
  onRunsRemove: (runIds: string[]) => void
}

/*
  What the reader can do from the note that ended the latest response, as the design offers it
  under a stopped note: Resume, which carries the response on, for a run stopped or interrupted, and
  Retry, which answers the reader's message again, for any run that ended with a note. The run
  either starts counts as going at once, so the note's actions go and the composer offers Stop
  before the page's live read shows it; a Retry's deleted messages leave the thread at once too.
  A click the server did not take says so, and can be made again, which is the same resume or retry
*/
function ConversationNoteActions({ conversationId, runId, canResume, onRunStart, onRunsRemove }: Props) {
  const { formatMessage } = useIntl()
  const resumeConversationRun = useResumeConversationRun()
  const retryConversationRun = useRetryConversationRun()
  const [pendingAction, setPendingAction] = useState<'resume' | 'retry' | null>(null)
  const [failure, setFailure] = useState<ConversationSendFailure | null>(null)

  async function act(action: 'resume' | 'retry') {
    if (pendingAction) return

    setPendingAction(action)
    setFailure(null)

    try {
      if (action === 'resume') {
        const started = await resumeConversationRun({ conversationId, runId })

        onRunStart({ runId: started.runId, previousRunId: runId })
      } else {
        const started = await retryConversationRun({ conversationId, runId })

        onRunsRemove(started.removedRunIds)
        onRunStart({ runId: started.runId, previousRunId: runId })
      }
    } catch (error) {
      console.error(`The response could not be ${action === 'resume' ? 'resumed' : 'retried'}`, error)

      setFailure(getConversationSendFailure(error))
    } finally {
      setPendingAction(null)
    }
  }

  function renderFailure() {
    if (!failure) return null

    const message =
      failure === 'busy'
        ? conversationMessages.composerBusy
        : failure === 'unavailable'
          ? conversationMessages.composerUnavailable
          : conversationMessages.noteActionError

    return (
      <p
        role="alert"
        className="m-0 text-center text-xs text-danger"
      >
        {formatMessage(message)}
      </p>
    )
  }

  return (
    <>
      <div className="flex gap-2">
        {canResume ? (
          <Button
            variant="outline"
            size="sm"
            icon={pendingAction === 'resume' ? <Spinner tone="current" /> : <PlayIcon />}
            disabled={pendingAction !== null}
            onClick={() => act('resume')}
          >
            {formatMessage(conversationMessages.noteResume)}
          </Button>
        ) : null}
        <Button
          // Beside Resume it is the second choice; alone, the one way on
          variant={canResume ? 'transparent' : 'outline'}
          size="sm"
          icon={pendingAction === 'retry' ? <Spinner tone="current" /> : <RefreshCwIcon />}
          disabled={pendingAction !== null}
          onClick={() => act('retry')}
        >
          {formatMessage(conversationMessages.noteRetry)}
        </Button>
      </div>
      {renderFailure()}
    </>
  )
}

export default ConversationNoteActions
