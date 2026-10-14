import { ExternalLinkIcon, RefreshCwIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button, buttonVariants } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'

import type { ConnectAttempt } from '~hooks/integration/useIntegrationConnect'

import getIntegrationFailureMessage from '~utils/integration/getIntegrationFailureMessage'

import Spinner from '~components/common/Spinner'

import integrationMessages from '~data/intl/messages/integration'

type Props = {
  attempt: ConnectAttempt
  onCancel: () => void
  onRetry: () => void
}

/*
  The dialog the Integrations page shows while the reader signs in to a server in the window it
  opened, as designed: waiting for the server, with Cancel. A window the browser blocked is offered
  as a link to the sign-in, which opens it on the reader's own click. A Connect that failed, or that
  the reader refused in the window, says so, with Try again
*/
function IntegrationConnectDialog({ attempt, onCancel, onRetry }: Props) {
  const { formatMessage } = useIntl()
  const { integration, failure, isBlocked, authorizationUrl } = attempt
  const name = integration.name

  function renderBody() {
    if (failure) {
      return (
        <Alert
          variant="danger"
          actions={
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCwIcon />}
              onClick={onRetry}
            >
              {formatMessage(integrationMessages.connectRetry)}
            </Button>
          }
        >
          {failure === 'denied'
            ? formatMessage(integrationMessages.connectDenied, { name })
            : formatMessage(getIntegrationFailureMessage(failure))}
        </Alert>
      )
    }

    if (isBlocked && authorizationUrl) {
      return (
        <div className="flex flex-col items-center gap-3 py-4 text-center text-sm text-muted-foreground">
          <p className="m-0 text-pretty">{formatMessage(integrationMessages.connectBlocked)}</p>
          <a
            href={authorizationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'primary', size: 'sm' })}
          >
            <ExternalLinkIcon aria-hidden="true" />
            {formatMessage(integrationMessages.connectOpen, { name })}
          </a>
        </div>
      )
    }

    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 pt-4 pb-1 text-center text-sm text-muted-foreground"
      >
        <Spinner size="lg" />
        <span>{formatMessage(integrationMessages.connectWaiting, { name })}</span>
      </div>
    )
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && onCancel()}
    >
      <DialogContent
        closeLabel={formatMessage(integrationMessages.close)}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="break-words">{formatMessage(integrationMessages.connectTitle, { name })}</DialogTitle>
          <DialogDescription>{formatMessage(integrationMessages.connectDescription, { name })}</DialogDescription>
        </DialogHeader>
        {renderBody()}
        <DialogFooter>
          <Button
            variant="transparent"
            onClick={onCancel}
          >
            {formatMessage(integrationMessages.cancel)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default IntegrationConnectDialog
