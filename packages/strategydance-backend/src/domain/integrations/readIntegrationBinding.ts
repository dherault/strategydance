import type { IntegrationTool } from 'strategydance-core'
import { IntegrationAuthentication } from 'strategydance-database/backend'

type BindingIntegration = {
  authentication: IntegrationAuthentication
  configRevision: number
  keyGeneration: number
  tools: IntegrationTool[] | null
}

type BindingConnection = { generation: string; configRevision: number }

/*
  What a call to a server's tool would be bound to now: the server's revision, the tool's definition
  as the server last listed it, null when it lists no such tool, and the generation of the credential
  that makes the call, the key's for a key-based server, the member's connection's for an OAuth one,
  null for one without, or for a member with no connection made under the server's revision. An
  approval holds while these are the ones it was given for
*/
function readIntegrationBinding(
  integration: BindingIntegration,
  connection: BindingConnection | null,
  toolName: string,
) {
  const tool = integration.tools?.find(({ name }) => name === toolName)

  return {
    configRevision: integration.configRevision,
    toolHash: tool?.definitionHash ?? null,
    credentialGeneration:
      integration.authentication === IntegrationAuthentication.API_KEY
        ? String(integration.keyGeneration)
        : integration.authentication === IntegrationAuthentication.OAUTH
            && connection
            && connection.configRevision === integration.configRevision
          ? connection.generation
          : null,
  }
}

export default readIntegrationBinding
