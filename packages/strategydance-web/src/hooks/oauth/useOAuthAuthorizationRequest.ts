import { useQuery } from '@tanstack/react-query'
import type { OAuthAuthorizationRequestSummary } from 'strategydance-core'

import type { DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCanUseModules from '~hooks/module/useCanUseModules'

import { requestApi } from '~data/api'

/*
  The authorization request an external agent made, as the consent page shows it: who is asking,
  where the member will be sent back, the module and the access asked for. Null while there is
  none to read, and `error` says why a read was refused.

  Read once, and never again on its own: reading it is what has the backend fetch a client's
  metadata document, which is metered per member, and a read after the member decided would answer
  that the request is gone while the browser is on its way back to the agent. So no retry, no read
  on focus or on reconnecting, and nothing goes stale. Trying again is the failure view's button to
  press.

  Nothing is read for a reader who may not connect agents, whom the page turns away first, nor
  without an id. The key carries the uid, so signing into another account on the same tab reads it
  again as that account
*/
function useOAuthAuthorizationRequest(
  requestId: string | undefined,
): DataSource<OAuthAuthorizationRequestSummary | null> & { error: Error | null } {
  const { data: viewer } = useAuthentication()
  const canUseModules = useCanUseModules()

  const viewerId = viewer?.uid ?? null
  const isEnabled = Boolean(requestId && viewerId && canUseModules)

  const { data, error, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['OAuthAuthorizationRequest', requestId ?? null, viewerId],
    queryFn: ({ signal }) =>
      requestApi<OAuthAuthorizationRequestSummary>({ method: 'GET', path: `/oauth/requests/${requestId}`, signal }),
    enabled: isEnabled,
    retry: false,
    retryOnMount: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return {
    data: data ?? null,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    error: isEnabled && isError ? error : null,
  }
}

export default useOAuthAuthorizationRequest
