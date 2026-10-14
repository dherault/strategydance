import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { OutboundRequest, OutboundStream, ResolvedAddress } from '~utils/requestOutbound'

import hashIntegrationToolDefinition from '../hashIntegrationToolDefinition'

export const FAKE_SERVER_URL = 'https://mcp.example.com/mcp'

const PUBLIC_ADDRESS = { address: '93.184.215.14', family: 4 }

// The tools the server lists, as `OrganizationIntegration.tools` keeps them once listed
const DEFINITIONS = [
  {
    name: 'list_issues',
    description: 'List the issues matching a query',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'create_issue',
    description: 'Create an issue',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
]

type IntegrationServerFakeOptions = {
  // What a request has to carry to be answered rather than refused with a 401
  isAuthorized?: (headers: Headers) => boolean
}

/*
  An organization's MCP server taking a key or none, built by the SDK's own handler, as remote
  servers are, for the tests of calls: the network the guarded fetch reaches (`resolve`, `send`), the
  arguments of each call as they were sent, and its tools as listing them stored them. A tool answers
  its query back, or, when `isFailing` is set, an error. `pendingCalls` holds a call back until the
  test lets it go, as a server still working when its caller crashes
*/
function createIntegrationServerFake({ isAuthorized = () => true }: IntegrationServerFakeOptions = {}) {
  const calls: { name: string; arguments: unknown }[] = []
  const switches = { isFailing: false, isHeld: false }
  const held: (() => void)[] = []
  const handler = createMcpHandler(
    () => {
      const server = new McpServer({ name: 'fake', version: '1.0.0' }, { capabilities: { tools: {} } })

      for (const { name, description } of DEFINITIONS) {
        server.registerTool(name, { description, inputSchema: z.object({ query: z.string() }) }, async ({ query }) => {
          if (switches.isHeld) await new Promise<void>(resolve => held.push(resolve))

          return {
            content: [{ type: 'text', text: switches.isFailing ? 'The tracker is down' : `${name}: ${query}` }],
            ...(switches.isFailing && { isError: true }),
          }
        })
      }

      return server
    },
    { responseMode: 'sse', legacy: 'stateless' },
  )

  async function send(
    url: URL,
    _address: ResolvedAddress,
    headers: Record<string, string>,
    signal: AbortSignal,
    { method, body }: OutboundRequest,
  ): Promise<OutboundStream> {
    const request = new Request(url, { method, headers, body: body && new Uint8Array(body), signal })
    const text = await request.clone().text()
    const message: unknown = text ? JSON.parse(text) : null

    if (isToolCall(message)) calls.push({ name: message.params.name, arguments: message.params.arguments })

    const response = isAuthorized(request.headers)
      ? await handler.fetch(request)
      : new Response('Unauthorized', { status: 401 })

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: (async function* () {
        if (!response.body) return

        for await (const chunk of response.body) yield chunk
      })(),
    }
  }

  return {
    send,
    resolve: async () => [PUBLIC_ADDRESS],
    calls,
    switches,
    // Lets go of the calls held back
    release: () => held.splice(0).forEach(resolve => resolve()),
    // Its tools as listing them would store them, each with the hash an approval is bound to
    storedTools: () =>
      JSON.stringify(
        DEFINITIONS.map(definition => ({ ...definition, definitionHash: hashIntegrationToolDefinition(definition) })),
      ),
    hashOf: (name: string) => {
      const definition = DEFINITIONS.find(tool => tool.name === name)

      if (!definition) throw new Error(`The fake server has no tool called ${name}`)

      return hashIntegrationToolDefinition(definition)
    },
  }
}

// Whether a JSON-RPC message calls a tool
function isToolCall(message: unknown): message is { params: { name: string; arguments: unknown } } {
  return (
    typeof message === 'object'
    && message !== null
    && 'method' in message
    && message.method === 'tools/call'
    && 'params' in message
    && typeof message.params === 'object'
    && message.params !== null
  )
}

export default createIntegrationServerFake
