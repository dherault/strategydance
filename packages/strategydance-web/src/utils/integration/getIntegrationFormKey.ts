import type { OrganizationIntegration } from '~types'

/*
  What a server's dialog is keyed by: the server and every setting its form edits, so another
  administrator's change to one, pushed by the live list while the dialog is open, mounts it anew
  on the new values. A form left on the old ones would send them back as a change of its own, and
  write over theirs. A change the form does not edit, turning the server off, its error or its last
  use, keeps the draft
*/
function getIntegrationFormKey(integration: OrganizationIntegration) {
  return JSON.stringify([
    integration.id,
    integration.name,
    integration.url,
    integration.authentication,
    integration.apiKeyScheme,
    integration.apiKeyHeader ?? null,
    integration.apiKeyLastFour ?? null,
  ])
}

export default getIntegrationFormKey
