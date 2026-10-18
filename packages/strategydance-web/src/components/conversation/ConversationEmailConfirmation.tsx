import { sendEmailVerification } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useAuthentication from '~hooks/authentication/useAuthentication'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

// What the last action did. Whether a link went out at all is kept apart, so a resend that fails
// still leaves the link already sent to check
type Status = 'idle' | 'sending' | 'sent' | 'checking' | 'unconfirmed' | 'failed'

const STATUS_MESSAGES = {
  sent: conversationMessages.confirmationSent,
  unconfirmed: conversationMessages.confirmationNotConfirmed,
  failed: conversationMessages.confirmationError,
}

/*
  What the composer shows a reader whose address is not confirmed, which a password sign-up never is
  by itself, above the field: Strategy Dance answers only a confirmed address, since an account costs
  nothing to make and the daily limits are an account's. It sends Firebase's confirmation link,
  which leads back to the page, and asks the account again once the reader says they opened it,
  which mints the token the backend reads, as `OrganizationInvitationUnverified` does. It asks once
  as it appears too, for a reader who confirmed in another tab. What they write meanwhile stays
*/
function ConversationEmailConfirmation() {
  const { formatMessage } = useIntl()
  const { data: viewer, refetch } = useAuthentication()
  const [status, setStatus] = useState<Status>('idle')
  const [hasSent, setHasSent] = useState(false)

  const email = viewer?.email ?? ''

  // A failure here leaves the buttons, which ask again
  useEffect(() => {
    refetch().catch(() => {})
  }, [refetch])

  async function handleSend() {
    if (!viewer) return

    setStatus('sending')

    try {
      await sendEmailVerification(viewer, { url: window.location.href })

      setHasSent(true)
      setStatus('sent')
    } catch {
      setStatus('failed')
    }
  }

  async function handleCheck() {
    setStatus('checking')

    try {
      await refetch()

      // Still drawn means still unconfirmed: a confirmed reader's composer draws no notice
      setStatus('unconfirmed')
    } catch {
      setStatus('failed')
    }
  }

  const isBusy = status === 'sending' || status === 'checking'

  return (
    <Alert
      variant="warning"
      title={formatMessage(conversationMessages.confirmationTitle)}
      actions={
        <>
          {hasSent ? (
            <Button
              size="sm"
              disabled={isBusy}
              icon={status === 'checking' ? <Spinner tone="current" /> : undefined}
              onClick={handleCheck}
            >
              {formatMessage(conversationMessages.confirmationCheck)}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={hasSent ? 'outline' : undefined}
            disabled={isBusy}
            icon={status === 'sending' ? <Spinner tone="current" /> : undefined}
            onClick={handleSend}
          >
            {formatMessage(hasSent ? conversationMessages.confirmationResend : conversationMessages.confirmationSend)}
          </Button>
        </>
      }
    >
      <p className="m-0">
        {formatMessage(
          status === 'sent' || status === 'unconfirmed' || status === 'failed'
            ? STATUS_MESSAGES[status]
            : conversationMessages.confirmationLead,
          { email },
        )}
      </p>
    </Alert>
  )
}

export default ConversationEmailConfirmation
