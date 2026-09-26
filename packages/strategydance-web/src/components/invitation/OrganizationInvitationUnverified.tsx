import { sendEmailVerification } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useAuthentication from '~hooks/authentication/useAuthentication'

import Spinner from '~components/common/Spinner'

import invitationMessages from '~data/intl/messages/invitation'

type Status = 'idle' | 'sending' | 'sent' | 'checking' | 'unconfirmed' | 'sendFailed' | 'checkFailed'

/*
  What the invitation page shows a reader whose address is not verified, which a password sign-up
  never is by itself. An invitation can only be read with a verified address, since otherwise the
  address proves nothing, so this sends Firebase's confirmation link, which leads back to this
  page, and asks the account again once the reader says they opened it.

  It asks once on mount too. Somebody coming back through the link lands on a fresh load, whose
  restored session still says unverified until the account is asked again
*/
function OrganizationInvitationUnverified() {
  const { formatMessage } = useIntl()
  const { data: viewer, refetch } = useAuthentication()
  const [status, setStatus] = useState<Status>('idle')

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

      setStatus('sent')
    }
    catch {
      setStatus('sendFailed')
    }
  }

  async function handleCheck() {
    setStatus('checking')

    try {
      await refetch()

      // Still mounted means still unverified: a verified reader is shown the invitation instead
      setStatus('unconfirmed')
    }
    catch {
      setStatus('checkFailed')
    }
  }

  const hasSent = status !== 'idle' && status !== 'sending' && status !== 'sendFailed'

  return (
    <>
      <h1 className="m-0 text-5xl leading-[1.05]">
        {formatMessage(invitationMessages.unverifiedTitle)}
      </h1>
      <p className="m-0 max-w-xl text-base leading-[1.6] text-pretty text-muted-foreground">
        {formatMessage(invitationMessages.unverifiedLead, { email })}
      </p>
      {status === 'sent' && (
        <Alert
          variant="info"
          className="max-w-xl"
        >
          {formatMessage(invitationMessages.confirmationSent, { email })}
        </Alert>
      )}
      {status === 'unconfirmed' && (
        <Alert
          variant="warning"
          className="max-w-xl"
        >
          {formatMessage(invitationMessages.notConfirmed, { email })}
        </Alert>
      )}
      {(status === 'sendFailed' || status === 'checkFailed') && (
        <Alert
          variant="danger"
          className="max-w-xl"
        >
          {formatMessage(invitationMessages.confirmationError)}
        </Alert>
      )}
      <div className="flex flex-wrap gap-3">
        {hasSent && (
          <Button
            disabled={status === 'checking'}
            icon={status === 'checking' ? <Spinner tone="current" /> : undefined}
            onClick={handleCheck}
          >
            {formatMessage(invitationMessages.checkConfirmation)}
          </Button>
        )}
        <Button
          variant={hasSent ? 'outline' : undefined}
          disabled={status === 'sending' || status === 'checking'}
          icon={status === 'sending' ? <Spinner tone="current" /> : undefined}
          onClick={handleSend}
        >
          {formatMessage(hasSent ? invitationMessages.resendConfirmation : invitationMessages.sendConfirmation)}
        </Button>
      </div>
    </>
  )
}

export default OrganizationInvitationUnverified
