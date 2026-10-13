import type { IntegrationKeyOwner } from '~domain/integrations/buildIntegrationSecretContext'
import encryptIntegrationSecret from '~domain/integrations/encryptIntegrationSecret'

// An organization's key for an MCP server, encrypted for `OrganizationIntegration.encryptedApiKey`
// and bound to its organization and server
async function encryptIntegrationKey(key: string, owner: IntegrationKeyOwner) {
  return encryptIntegrationSecret(key, { purpose: 'api-key', ...owner })
}

export default encryptIntegrationKey
