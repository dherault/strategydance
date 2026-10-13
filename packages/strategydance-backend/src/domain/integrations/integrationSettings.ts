import { IntegrationApiKeyScheme, IntegrationAuthentication } from 'strategydance-database/backend'

import type { IntegrationCredential } from '~domain/integrations/listIntegrationTools'

/*
  A server as an administrator's form describes it, once the route checked each field: its name,
  its address as the URL parser writes it, its authentication, how a key is sent, and the key typed,
  which a form leaves out to keep the one stored
*/
type IntegrationSettings = {
  name: string
  url: string
  authentication: IntegrationAuthentication
  apiKey: string | null
  apiKeyScheme: IntegrationApiKeyScheme
  apiKeyHeader: string | null
}

// How a key-based server is sent its key, from settings and the key to send
function toIntegrationCredential(settings: IntegrationSettings, key: string): IntegrationCredential {
  return {
    key,
    scheme: settings.apiKeyScheme,
    header: settings.apiKeyScheme === IntegrationApiKeyScheme.HEADER ? settings.apiKeyHeader : null,
  }
}

// The shortest key whose last four characters every member may read: of a shorter one, they would give
// too much of it away
const MIN_KEY_LENGTH_SHOWN = 12

// A key's last four characters, as the page shows them to name it, or null for a key too short to show
function toApiKeyLastFour(key: string) {
  return key.length >= MIN_KEY_LENGTH_SHOWN ? key.slice(-4) : null
}

// The key's fields as stored for settings, how it is sent included, null for a server taking none
function toStoredKeyFields(settings: IntegrationSettings, key: string | null) {
  const isKeyed = settings.authentication === IntegrationAuthentication.API_KEY && key !== null

  return {
    apiKeyLastFour: isKeyed ? toApiKeyLastFour(key) : null,
    apiKeyScheme: isKeyed ? settings.apiKeyScheme : IntegrationApiKeyScheme.BEARER,
    apiKeyHeader: isKeyed && settings.apiKeyScheme === IntegrationApiKeyScheme.HEADER ? settings.apiKeyHeader : null,
  }
}

export { type IntegrationSettings, toApiKeyLastFour, toIntegrationCredential, toStoredKeyFields }
