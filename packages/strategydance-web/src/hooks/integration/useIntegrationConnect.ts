import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { INTEGRATION_CONNECTION_CHANNEL, type IntegrationConnectionMessage } from 'strategydance-core'
import { type GetIntegrationConnectionsData, IntegrationConnectionStatus } from 'strategydance-database/web'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { IntegrationConnection, OrganizationIntegration } from '~types'

import useIntegrationConnectionRequests from '~hooks/integration/useIntegrationConnectionRequests'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import readIntegrationFailure, { type IntegrationFailure } from '~utils/integration/readIntegrationFailure'
import readIntegrationFailureCode from '~utils/integration/readIntegrationFailureCode'

import integrationMessages from '~data/intl/messages/integration'

/*
  A Connect under way, from the page's side: the server, the reader's connection to it when it began,
  so the one it makes is told apart, the sign-in's address once the backend gave it, whether the
  browser blocked the window it was to open in, and how it failed, if it did
*/
type ConnectAttempt = {
  integration: OrganizationIntegration
  previousConnectionId: string | null
  authorizationUrl: string | null
  // The Connect's id once the backend answered, which a Cancel names
  authorizationId: string | null
  isBlocked: boolean
  failure: IntegrationFailure | 'denied' | null
}

// The window a sign-in opens in, by name, so a second Connect reuses it rather than opening another
const SIGN_IN_WINDOW_NAME = 'strategydance-integration-sign-in'

const SIGN_IN_WINDOW_FEATURES = 'popup,width=520,height=720'

// How long a Connect waits for its sign-in, its authorization's ten minutes in the backend
const CONNECT_LIFETIME_MS = 10 * 60 * 1000

/*
  Connecting the reader's own account to one of the organization's OAuth servers, from the
  Integrations page: `connect` opens a blank window inside the click, so no popup blocker refuses it,
  cuts it off from this page, since the authorization server's page will run in it and could
  otherwise send this tab elsewhere, starts the Connect, and sends the window to the sign-in, an
  https address alone, since the window is of this page's own origin until then.

  The Connect lands when the reader's live connection to the server appears anew, which is the
  proof: the page the sign-in ends on also says how it went, on a channel every tab of the origin
  hears, which ends a failed or refused Connect at once when it names it and nudges a connected one,
  since anybody can open that page. Whether the window was closed is never read, since an authorization server's
  Cross-Origin-Opener-Policy makes it read as closed while the reader is still in it. A Connect with
  no news after its ten minutes has expired; Cancel cancels it, by its id, so a sign-in finished in the
  window afterwards connects nothing
*/
function useIntegrationConnect(connections: IntegrationConnection[]) {
  const { formatMessage } = useIntl()
  const queryClient = useQueryClient()
  const { organization } = useCurrentOrganization()
  const { startConnection, cancelConnection } = useIntegrationConnectionRequests()
  const [attempt, setAttempt] = useState<ConnectAttempt | null>(null)
  const windowRef = useRef<Window | null>(null)
  // Which `connect` is current, so a start that answers after its Connect was canceled cancels it too
  const currentConnectRef = useRef<symbol | null>(null)

  const organizationId = organization?.id ?? null
  const integrationId = attempt?.integration.id ?? null
  const integrationName = attempt?.integration.name ?? null
  const authorizationId = attempt?.authorizationId ?? null
  const previousConnectionId = attempt?.previousConnectionId ?? null
  const isWaiting = attempt !== null && attempt.failure === null

  useEffect(() => {
    if (!isWaiting || integrationId === null || integrationName === null) return

    const connectionsKey = JSON.stringify(['GetIntegrationConnections', organizationId])
    let hasLanded = false

    // The reader's live connections, as their subscription writes them into the cache: the Connect
    // lands once the reader's connection to the server appears anew
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (hasLanded || event.type !== 'updated' || JSON.stringify(event.query.queryKey) !== connectionsKey) return

      const data = event.query.state.data as GetIntegrationConnectionsData | undefined
      const isLanded = (data?.integrationConnections ?? []).some(
        connection =>
          connection.integrationId === integrationId
          && connection.id !== previousConnectionId
          && connection.status === IntegrationConnectionStatus.CONNECTED,
      )

      if (!isLanded) return

      hasLanded = true
      windowRef.current = null
      setAttempt(current => (current?.integration.id === integrationId ? null : current))
      toast.success(formatMessage(integrationMessages.connected, { name: integrationName }))
    })

    const channel = new BroadcastChannel(INTEGRATION_CONNECTION_CHANNEL)

    channel.onmessage = (event: MessageEvent<IntegrationConnectionMessage>) => {
      const { data } = event

      if (data.outcome === 'connected') {
        queryClient.invalidateQueries({ queryKey: ['GetIntegrationConnections', organizationId] }).catch(() => {})

        return
      }

      // A failure ends this Connect only when it names it: one from an older sign-in, or naming none,
      // leaves it waiting on its own
      const isForThis =
        authorizationId !== null
        && data.authorizationId !== null
        && toCanonicalId(data.authorizationId) === toCanonicalId(authorizationId)

      if (!isForThis) return

      setAttempt(current =>
        current?.integration.id === integrationId
          ? { ...current, failure: data.outcome === 'denied' ? 'denied' : readIntegrationFailureCode(data.code) }
          : current,
      )
    }

    const timeout = setTimeout(() => {
      setAttempt(current =>
        current?.integration.id === integrationId && current.failure === null
          ? { ...current, failure: 'authorizationExpired' }
          : current,
      )
    }, CONNECT_LIFETIME_MS)

    return () => {
      unsubscribe()
      channel.close()
      clearTimeout(timeout)
    }
  }, [
    isWaiting,
    integrationId,
    integrationName,
    authorizationId,
    previousConnectionId,
    organizationId,
    queryClient,
    formatMessage,
  ])

  async function connect(integration: OrganizationIntegration) {
    const signInWindow = window.open('', SIGN_IN_WINDOW_NAME, SIGN_IN_WINDOW_FEATURES)
    const connectToken = Symbol(integration.id)

    currentConnectRef.current = connectToken

    if (signInWindow) signInWindow.opener = null

    windowRef.current = signInWindow
    setAttempt({
      integration,
      previousConnectionId: connections.find(connection => connection.integrationId === integration.id)?.id ?? null,
      authorizationUrl: null,
      authorizationId: null,
      isBlocked: signInWindow === null,
      failure: null,
    })

    try {
      const { authorizationUrl, authorizationId } = await startConnection(integration.id)

      // Canceled while the backend was answering: the Connect it made is canceled too
      if (currentConnectRef.current !== connectToken) {
        cancelConnection(integration.id, authorizationId).catch((error: unknown) => {
          console.error('A Connect could not be canceled', error)
        })

        return
      }

      if (!isHttpsAddress(authorizationUrl)) throw new Error('A sign-in at an address that is not https')

      const isOpen = signInWindow !== null && !signInWindow.closed

      if (isOpen) signInWindow.location.href = authorizationUrl

      setAttempt(current =>
        current?.integration.id === integration.id
          ? { ...current, authorizationUrl, authorizationId, isBlocked: !isOpen }
          : current,
      )
    } catch (error) {
      console.error('A Connect could not start', error)
      signInWindow?.close()
      setAttempt(current =>
        current?.integration.id === integration.id ? { ...current, failure: readIntegrationFailure(error) } : current,
      )
    }
  }

  /*
    Cancels the Connect under way by its id, so a Connect started right after, which replaces it, is
    never the one a late cancel deletes. One whose id the backend has not answered yet is canceled by
    its `connect` once it does
  */
  function cancel() {
    if (!attempt) return

    currentConnectRef.current = null
    windowRef.current?.close()
    windowRef.current = null
    setAttempt(null)

    if (attempt.failure !== null) return

    toast(formatMessage(integrationMessages.connectCanceled))

    if (attempt.authorizationId === null) return

    cancelConnection(attempt.integration.id, attempt.authorizationId).catch((error: unknown) => {
      console.error('A Connect could not be canceled', error)
    })
  }

  return {
    // The Connect under way or failed
    attempt,
    connect,
    cancel,
  }
}

function isHttpsAddress(address: string) {
  try {
    return new URL(address).protocol === 'https:'
  } catch {
    return false
  }
}

// An id as the database keeps it, whichever spelling it came in
function toCanonicalId(id: string) {
  return id.replaceAll('-', '').toLowerCase()
}

export { type ConnectAttempt }

export default useIntegrationConnect
