import { PlugIcon } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

import { SUPPORT_CONTACT } from '~constants'

import useAnswerConversationApproval from '~hooks/conversation/useAnswerConversationApproval'
import useConversationApprovalAnswer from '~hooks/conversation/useConversationApprovalAnswer'
import useRefreshConversationAccess from '~hooks/conversation/useRefreshConversationAccess'

import formatConversationToolJson from '~utils/conversation/formatConversationToolJson'
import getConversationAnswerFailure, {
  type ConversationAnswerFailure,
} from '~utils/conversation/getConversationAnswerFailure'
import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

import Spinner from '~components/common/Spinner'
import ConversationApprovalDialog from '~components/conversation/ConversationApprovalDialog'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
  entry: ConversationThreadEntry
  body: ConversationMessageBody
  // The run the conversation waits on, while it waits for this approval, and null otherwise
  waitingRunId: string | null
  // Whether a question or another approval of the same turn still waits, which deciding this one
  // leaves waiting
  hasOtherWaiting: boolean
  // The strip under it, when its server does not work for the reader now
  issue?: ReactNode
  onRunStart: (startedRun: StartedConversationRun) => void
}

const NOTICE_MESSAGES = {
  conflict: conversationMessages.approvalConflict,
  unavailable: conversationMessages.approvalUnavailable,
  error: conversationMessages.approvalError,
  queued: conversationMessages.approvalQueued,
  unverified: conversationMessages.accessUnverified,
  suspended: conversationMessages.accessSuspended,
} as const

/*
  A call Strategy Dance wants to make to one of the organization's integrations, waiting for the
  reader's approval, built from the question's look, which the design leaves it: which server, which
  tool, and the start of what it would send, then Deny, and Allow, which first opens what it would
  send whole, the dialog's own Allow approving. A preview authorizes nothing, since what matters can
  sit past its cut.

  Deciding carries the conversation on once nothing of the turn waits, as answering a question does.
  An Allow given after the server, the tool or the reader's account changed is denied instead, which
  the call it became says, Strategy Dance proposing the call again if it still needs it. One the response it
  belongs to was stopped or cut off before, which a resume makes answerable again, shows its buttons
  off. The thread draws it as the call it became once it is decided.

  The decision under way outlives the card's view (`useConversationApprovalAnswer`), so moving its
  conversation between its page and the dock loses none of it
*/
function ConversationApproval({
  conversationId,
  entry,
  body,
  waitingRunId,
  hasOtherWaiting,
  issue = null,
  onRunStart,
}: Props) {
  const { formatMessage } = useIntl()
  const answerConversationApproval = useAnswerConversationApproval()
  const titleId = useId()
  const [{ sending }, changeAnswer] = useConversationApprovalAnswer(entry.id)
  const refreshConversationAccess = useRefreshConversationAccess()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  /*
    What deciding came to when it did not start a run: a failure, or a decision kept that the
    conversation goes on from later, each said while the conversation still waits on the run it was
    sent to. An Allow denied because the server changed is kept with the answer instead, since the
    approval makes way for the call it became, which says it (`ConversationDecidedApproval`)
  */
  const [notice, setNotice] = useState<{
    kind: ConversationAnswerFailure | 'queued'
    waitingRunId: string
  } | null>(null)
  const isAnswerable = waitingRunId !== null
  const integrationName = body.integrationName ?? ''
  const integrationToolName = body.integrationToolName ?? ''

  async function decide(isAllowed: boolean) {
    setIsDialogOpen(false)

    if (!waitingRunId || sending) return

    changeAnswer({ sending: isAllowed ? 'allow' : 'deny' })
    setNotice(null)

    try {
      const { runId, isChanged } = await answerConversationApproval({
        conversationId,
        messageId: entry.id,
        isAllowed,
      })

      if (isChanged) changeAnswer({ isChanged: true })
      if (runId) onRunStart({ runId, previousRunId: waitingRunId })
      else if (!hasOtherWaiting && !isChanged) setNotice({ kind: 'queued', waitingRunId })
    } catch (error) {
      console.error('The decision could not be sent', error)

      const failure = getConversationAnswerFailure(error)

      setNotice({ kind: failure, waitingRunId })

      if (failure === 'suspended') refreshConversationAccess()
    } finally {
      changeAnswer({ sending: null })
    }
  }

  function renderNotice() {
    if (!notice || notice.waitingRunId !== waitingRunId) return null

    const isFailure = notice.kind !== 'queued'

    return (
      <p
        role={isFailure ? 'alert' : 'status'}
        className={cn('m-0 text-xs', isFailure ? 'text-danger' : 'text-muted-foreground')}
      >
        {formatMessage(NOTICE_MESSAGES[notice.kind], { email: SUPPORT_CONTACT.email })}
      </p>
    )
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-xs border bg-white',
        isAnswerable ? 'border-primary-200' : 'border-border',
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 px-3.5 pt-3.5 pb-3">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase',
            isAnswerable ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {formatMessage(isAnswerable ? conversationMessages.approvalWaiting : conversationMessages.approvalUnanswered)}
        </span>
        <div className="-mt-1 flex min-w-0 items-start gap-2.5">
          <span className="grid size-7 flex-none place-items-center rounded-xs bg-neutral-100 text-neutral-600">
            <PlugIcon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              id={titleId}
              className="text-base leading-[1.45] font-semibold text-pretty wrap-anywhere text-secondary"
            >
              {formatMessage(conversationMessages.approvalPrompt, { server: integrationName })}
            </span>
            <span className="font-mono text-xs leading-[1.3] wrap-anywhere text-muted-foreground">
              {integrationToolName}
            </span>
          </span>
        </div>
        {body.argumentsPreview ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {formatMessage(conversationMessages.approvalArguments)}
            </span>
            <pre className="m-0 max-h-24 overflow-hidden rounded-xs border border-border bg-neutral-50 p-2.5 font-mono text-xs leading-[1.5] whitespace-pre-wrap text-foreground wrap-anywhere">
              {formatConversationToolJson(body.argumentsPreview)}
            </pre>
          </div>
        ) : null}
        {renderNotice()}
        {isAnswerable ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={sending === 'deny' ? <Spinner tone="current" /> : undefined}
              disabled={sending !== null}
              onClick={() => decide(false)}
            >
              {formatMessage(conversationMessages.approvalDeny)}
            </Button>
            <Button
              size="sm"
              aria-haspopup="dialog"
              icon={sending === 'allow' ? <Spinner tone="current" /> : undefined}
              disabled={sending !== null}
              onClick={() => setIsDialogOpen(true)}
            >
              {formatMessage(conversationMessages.approvalAllow)}
            </Button>
          </div>
        ) : null}
      </div>
      {issue}
      {isDialogOpen ? (
        <ConversationApprovalDialog
          messageId={entry.id}
          integrationName={integrationName}
          integrationToolName={integrationToolName}
          onAllow={() => decide(true)}
          onClose={() => setIsDialogOpen(false)}
        />
      ) : null}
    </section>
  )
}

export default ConversationApproval
