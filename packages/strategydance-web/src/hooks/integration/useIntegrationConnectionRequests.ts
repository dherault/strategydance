import type { StartIntegrationConnectionData } from 'strategydance-core'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

/*
  The calls any member makes for their own account at one of the current organization's OAuth
  servers: starting a Connect, which answers the address of its sign-in, canceling it, and
  disconnecting. The page reads nothing back from them: the reader's live connections show what
  changed. The finish is the page the sign-in ends on's own (`finishIntegrationConnection`). A refusal
  throws an `ApiError`, which `readIntegrationFailure` reads
*/
function useIntegrationConnectionRequests() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  function toPath(integrationId: string, suffix = '') {
    if (!organizationId) throw new Error('No organization is current')

    return `/organizations/${organizationId}/integrations/${integrationId}/connection${suffix}`
  }

  return {
    startConnection: (integrationId: string) =>
      requestApi<StartIntegrationConnectionData>({ method: 'POST', path: toPath(integrationId) }),
    cancelConnection: (integrationId: string) =>
      requestApi({ method: 'DELETE', path: toPath(integrationId, '/authorization') }),
    disconnect: (integrationId: string) => requestApi({ method: 'DELETE', path: toPath(integrationId) }),
  }
}

export default useIntegrationConnectionRequests
