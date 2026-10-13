import type { AddIntegrationData } from 'strategydance-core'
import type { IntegrationApiKeyScheme, IntegrationAuthentication } from 'strategydance-database/web'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

// A server as its dialog describes it, the key only when typed
type IntegrationSettings = {
  name: string
  url: string
  authentication: IntegrationAuthentication
  apiKey: string | null
  apiKeyScheme: IntegrationApiKeyScheme
  apiKeyHeader: string | null
}

// A server as a dialog showed it: what an edit is made from
type IntegrationShown = {
  name: string
  configRevision: number
  keyGeneration: number
}

/*
  The calls to the integrations' routes for the current organization, each of which an
  administrator alone makes. They answer nothing the page reads afterwards: the live list and the
  dialog's tools show what changed, as they show another administrator's changes. A refusal throws
  an `ApiError`, which `readIntegrationFailure` reads
*/
function useIntegrationRequests() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  function toPath(suffix = '') {
    if (!organizationId) throw new Error('No organization is current')

    return `/organizations/${organizationId}/integrations${suffix}`
  }

  return {
    addIntegration: (settings: IntegrationSettings) =>
      requestApi<AddIntegrationData>({ method: 'POST', path: toPath(), body: settings }),
    // Sent with the server as its dialog showed it, so an edit from a stale view is refused
    editIntegration: (integrationId: string, settings: IntegrationSettings, expected: IntegrationShown) =>
      requestApi({ method: 'PATCH', path: toPath(`/${integrationId}`), body: { ...settings, expected } }),
    retryIntegration: (integrationId: string) =>
      requestApi({ method: 'POST', path: toPath(`/${integrationId}/retry`) }),
    setIntegrationEnabled: (integrationId: string, isEnabled: boolean) =>
      requestApi({ method: 'PUT', path: toPath(`/${integrationId}/enabled`), body: { isEnabled } }),
    // Sent with the revision the tools were shown under
    setIntegrationToolApproval: (
      integrationId: string,
      approval: { definitionHash: string; isAutoApproved: boolean; configRevision: number },
    ) => requestApi({ method: 'PUT', path: toPath(`/${integrationId}/auto-approved-tools`), body: approval }),
    deleteIntegration: (integrationId: string) => requestApi({ method: 'DELETE', path: toPath(`/${integrationId}`) }),
    restoreIntegration: (integrationId: string) =>
      requestApi({ method: 'POST', path: toPath(`/${integrationId}/restore`) }),
  }
}

export { type IntegrationSettings }

export default useIntegrationRequests
