import { CheckCircle2Icon, CircleAlertIcon, CircleXIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { INTEGRATION_CONNECTION_CHANNEL, type IntegrationConnectionMessage } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'

import finishIntegrationConnection from '~utils/integration/finishIntegrationConnection'
import getIntegrationFailureMessage from '~utils/integration/getIntegrationFailureMessage'
import type { IntegrationConnectedRouteSearch } from '~utils/integration/parseIntegrationConnectedSearch'
import readIntegrationFailure, { type IntegrationFailure } from '~utils/integration/readIntegrationFailure'

import Spinner from '~components/common/Spinner'

import { ApiError } from '~data/api'
import integrationMessages from '~data/intl/messages/integration'

// How the sign-in ended, once it has: connected, refused by the reader, or failed, and why
type Ending = {
  outcome: IntegrationConnectionMessage['outcome']
  failure: IntegrationFailure | null
  code: string | null
}

/*
  The page an OAuth server's sign-in ends on, in the window the Integrations page opened for it: the
  backend's callback sends the browser here with what came back. A code that came back is finished
  here, by the reader signed in, which the backend does for the account that started the Connect
  alone, so a sign-in somebody else started and sent connects nothing.

  How it ended goes to the page that opened the window, on a channel every tab of the app's origin
  hears, since the authorization server may have cut this window off from it; that page takes it as
  a nudge and the reader's live connection as the proof. Then the window closes itself where the
  browser lets it, and says so where it does not, with a button that tries again
*/
function IntegrationConnected({ outcome, organization, integration, authorization }: IntegrationConnectedRouteSearch) {
  const { formatMessage } = useIntl()
  const isReceived = outcome === 'received' && Boolean(organization && integration && authorization)
  const [ending, setEnding] = useState<Ending | null>(() =>
    isReceived ? null : { outcome: outcome === 'denied' ? 'denied' : 'failed', failure: null, code: null },
  )
  const isFinishingRef = useRef(false)

  useEffect(() => {
    if (!isReceived || isFinishingRef.current || !organization || !integration || !authorization) return

    isFinishingRef.current = true

    finishIntegrationConnection(organization, integration, authorization)
      .then(() => setEnding({ outcome: 'connected', failure: null, code: null }))
      .catch((error: unknown) => {
        console.error('A Connect could not be finished', error)
        setEnding({
          outcome: 'failed',
          failure: readIntegrationFailure(error),
          code: error instanceof ApiError ? error.code : null,
        })
      })
  }, [isReceived, organization, integration, authorization])

  useEffect(() => {
    if (!ending) return

    const message: IntegrationConnectionMessage = {
      integrationId: integration ?? null,
      authorizationId: authorization ?? null,
      outcome: ending.outcome,
      code: ending.code,
    }

    try {
      const channel = new BroadcastChannel(INTEGRATION_CONNECTION_CHANNEL)

      channel.postMessage(message)
      channel.close()
    } catch (error) {
      console.error('The window that opened the sign-in could not be told how it ended', error)
    }

    window.close()
  }, [ending, integration, authorization])

  function renderEnding() {
    if (!ending) {
      return (
        <>
          <Spinner size="lg" />
          <h1 className="m-0 text-2xl">{formatMessage(integrationMessages.connectedPageConnecting)}</h1>
        </>
      )
    }

    const [Icon, title] =
      ending.outcome === 'connected'
        ? [CheckCircle2Icon, integrationMessages.connectedPageConnected]
        : ending.outcome === 'denied'
          ? [CircleXIcon, integrationMessages.connectedPageDenied]
          : [CircleAlertIcon, integrationMessages.connectedPageFailed]

    return (
      <>
        <Icon
          aria-hidden="true"
          className={ending.outcome === 'connected' ? 'size-10 text-success' : 'size-10 text-muted-foreground'}
        />
        <h1 className="m-0 text-2xl">{formatMessage(title)}</h1>
        {ending.failure ? (
          <p className="m-0 text-sm text-pretty text-muted-foreground">
            {formatMessage(getIntegrationFailureMessage(ending.failure))}
          </p>
        ) : null}
        <p className="m-0 text-sm text-muted-foreground">{formatMessage(integrationMessages.connectedPageClose)}</p>
        <Button
          variant="outline"
          onClick={() => window.close()}
        >
          {formatMessage(integrationMessages.close)}
        </Button>
      </>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-16">
      <div
        role="status"
        className="flex w-full max-w-sm flex-col items-center gap-4 text-center"
      >
        {renderEnding()}
      </div>
    </main>
  )
}

export default IntegrationConnected
