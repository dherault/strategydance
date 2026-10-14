import type { IntegrationTool } from 'strategydance-core'
import { IntegrationAuthentication, IntegrationConnectionStatus } from 'strategydance-database/backend'

/*
  Whether a server works for a member right now, and when it does, the generation of what makes its
  calls, which an approval is bound to: the key's for a key-based server, the member's connection's
  for an OAuth one, none for a server taking no authentication. Otherwise why not, in the order the
  member would fix it: an administrator turns the server on, the member connects, an administrator
  sets a key, and the tools are listed
*/
type IntegrationAvailability =
  | { outcome: 'available'; credentialGeneration: string | null }
  | { outcome: 'off' | 'notConnected' | 'needsAuthentication' | 'keyMissing' | 'toolsNotListed' }

type AvailabilityIntegration = {
  authentication: IntegrationAuthentication
  isEnabled: boolean
  configRevision: number
  keyGeneration: number
  hasKey: boolean
  tools: IntegrationTool[] | null
}

type AvailabilityConnection = {
  generation: string
  configRevision: number
  status: IntegrationConnectionStatus
}

function readIntegrationAvailability(
  integration: AvailabilityIntegration,
  connection: AvailabilityConnection | null,
): IntegrationAvailability {
  if (!integration.isEnabled) return { outcome: 'off' }

  let credentialGeneration: string | null = null

  switch (integration.authentication) {
    case IntegrationAuthentication.OAUTH:
      // A connection made under another revision was made for another server, and is gone with it
      if (!connection || connection.configRevision !== integration.configRevision) return { outcome: 'notConnected' }
      if (connection.status !== IntegrationConnectionStatus.CONNECTED) return { outcome: 'needsAuthentication' }

      credentialGeneration = connection.generation
      break
    case IntegrationAuthentication.API_KEY:
      if (!integration.hasKey) return { outcome: 'keyMissing' }

      credentialGeneration = String(integration.keyGeneration)
      break
    case IntegrationAuthentication.NONE:
      break
  }

  if (!integration.tools) return { outcome: 'toolsNotListed' }

  return { outcome: 'available', credentialGeneration }
}

export { type IntegrationAvailability }

export default readIntegrationAvailability
