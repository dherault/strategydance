import { MAX_INTEGRATION_TOOLS_BYTES } from 'strategydance-core'
import type { IntegrationTool } from 'strategydance-core'
import { IntegrationAuthentication, IntegrationError } from 'strategydance-database/backend'

import {
  INTEGRATION_OPERATION_TIMEOUT_MS,
  INTEGRATION_REQUEST_TIMEOUT_MS,
  MAX_INTEGRATION_RESPONSE_BYTES,
} from '~constants'

import createGuardedFetch from '~utils/createGuardedFetch'
import type { OutboundSend, ResolvedAddress } from '~utils/requestOutbound'

import classifyIntegrationFailure from '~domain/integrations/classifyIntegrationFailure'
import discoverIntegrationIssuer from '~domain/integrations/discoverIntegrationIssuer'
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

// The network the guard reaches, the system's unless a test stands in
type IntegrationNetwork = {
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>
  send?: OutboundSend
}

/*
  Reaches an organization's MCP server as it is configured, within 30 seconds in all, every request
  through the guarded fetch: an OAuth server's discovery, since its tools wait for a member's
  connection (M28), or any other's tools, listed with the organization's key when it takes one, and
  shaped as `OrganizationIntegration.tools` keeps them, each with the hash its approval is bound to.
  Whatever goes wrong throws an `IntegrationFailure` saying which way
*/
async function reachIntegration(
  { url, authentication, credential }: IntegrationConfiguration,
  { resolve, send }: IntegrationNetwork = {},
): Promise<IntegrationReach> {
  const signal = AbortSignal.timeout(INTEGRATION_OPERATION_TIMEOUT_MS)
  const fetch = createGuardedFetch({
    maxBytes: MAX_INTEGRATION_RESPONSE_BYTES,
    timeoutMs: INTEGRATION_REQUEST_TIMEOUT_MS,
    signal,
    resolve,
    send,
  })
  const origin = new URL(url).origin
  const isOAuth = authentication === IntegrationAuthentication.OAUTH

  try {
    if (isOAuth) {
      return {
        tools: null,
        toolCount: null,
        toolDefinitionHashes: [],
        issuer: await discoverIntegrationIssuer(url, fetch),
      }
    }

    const listed = await listIntegrationTools({ url, credential, fetch, signal })

    return { ...toStoredTools(listed, origin), issuer: null }
  } catch (error) {
    throw classifyIntegrationFailure(error, {
      hasKey: credential !== null,
      origin,
      isDiscovery: isOAuth,
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

export { type IntegrationConfiguration, type IntegrationNetwork, type IntegrationReach }

export default reachIntegration
