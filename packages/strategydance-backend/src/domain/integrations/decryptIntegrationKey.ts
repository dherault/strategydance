import type { IntegrationKeyOwner } from '~domain/integrations/buildIntegrationSecretContext'
import decryptIntegrationSecret from '~domain/integrations/decryptIntegrationSecret'

// The key `encryptIntegrationKey` encrypted for this organization and server, which opens for no
// other row and as no other secret
async function decryptIntegrationKey(encrypted: string, owner: IntegrationKeyOwner) {
  return decryptIntegrationSecret(encrypted, { purpose: 'api-key', ...owner })
}

export default decryptIntegrationKey
