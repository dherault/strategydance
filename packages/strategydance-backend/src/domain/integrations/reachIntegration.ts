import { MAX_INTEGRATION_TOOLS_BYTES } from 'strategydance-core'
import type { IntegrationTool } from 'strategydance-core'
import { IntegrationAuthentication, IntegrationError } from 'strategydance-database/backend'

import { INTEGRATION_OPERATION_TIMEOUT_MS } from '~constants'

import classifyIntegrationFailure from '~domain/integrations/classifyIntegrationFailure'
import createIntegrationFetch, { type IntegrationNetwork } from '~domain/integrations/createIntegrationFetch'
import discoverIntegrationAuthorizationServer from '~domain/integrations/discoverIntegrationAuthorizationServer'
import hashIntegrationToolDefinition from '~domain/integrations/hashIntegrationToolDefinition'
import IntegrationFailure from '~domain/integrations/IntegrationFailure'
import listIntegrationTools, { type IntegrationCredential } from '~domain/integrations/listIntegrationTools'

type IntegrationConfiguration = {
  url: string
  authentication: IntegrationAuthentication
  credential: IntegrationCredential | null
}

// What reaching a server found: its tools, as stored, or the issuer an OAuth server named
type IntegrationReach =
  | { tools: string; toolCount: number; toolDefinitionHashes: string[]; issuer: null }
  | { tools: null; toolCount: null; toolDefinitionHashes: string[]; issuer: string }

/*
  Reaches an organization's MCP server as it is configured, within 30 seconds in all, every request
  through the guarded fetch: an OAuth server's discovery when no member's token is given, or the
  tools, listed with the organization's key or a member's token when it takes one, and shaped as
  `OrganizationIntegration.tools` keeps them, each with the hash its approval is bound to. Whatever
  goes wrong throws an `IntegrationFailure` saying which way, a token refused as a key refused is
*/
async function reachIntegration(
  { url, authentication, credential }: IntegrationConfiguration,
  network: IntegrationNetwork = {},
): Promise<IntegrationReach> {
  const signal = AbortSignal.timeout(INTEGRATION_OPERATION_TIMEOUT_MS)
  const fetch = createIntegrationFetch(network, signal)
  const origin = new URL(url).origin
  const isDiscovery = authentication === IntegrationAuthentication.OAUTH && credential === null

  try {
    if (isDiscovery) {
      const { issuer } = await discoverIntegrationAuthorizationServer(url, fetch)

      return { tools: null, toolCount: null, toolDefinitionHashes: [], issuer }
    }

    const listed = await listIntegrationTools({ url, credential, fetch, signal })

    return { ...toStoredTools(listed, origin), issuer: null }
  } catch (error) {
    throw classifyIntegrationFailure(error, {
      hasKey: credential !== null,
      origin,
      isDiscovery,
    })
  }
}

type ListedTool = Awaited<ReturnType<typeof listIntegrationTools>>[number]

// The tools as stored, each name once, the first a server listed winning, within the size a row keeps
function toStoredTools(listed: ListedTool[], origin: string) {
  const names = new Set<string>()
  const tools: IntegrationTool[] = []

  for (const { name, title, description, inputSchema, annotations } of listed) {
    if (names.has(name)) continue

    names.add(name)
    tools.push({
      name,
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      inputSchema,
      ...(annotations !== undefined && { annotations }),
      definitionHash: hashIntegrationToolDefinition({ name, description, inputSchema, annotations }),
    })
  }

  const json = JSON.stringify(tools)

  if (Buffer.byteLength(json) > MAX_INTEGRATION_TOOLS_BYTES) {
    throw new IntegrationFailure(IntegrationError.TOO_MANY_TOOLS, `${origin}: its tools hold more than the row keeps`)
  }

  return { tools: json, toolCount: tools.length, toolDefinitionHashes: tools.map(tool => tool.definitionHash) }
}

export { type IntegrationConfiguration, type IntegrationReach }

export default reachIntegration
