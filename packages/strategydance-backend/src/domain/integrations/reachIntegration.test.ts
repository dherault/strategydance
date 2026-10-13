import { describe, expect, test } from 'bun:test'

import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { MAX_INTEGRATION_TOOLS } from 'strategydance-core'
import { IntegrationApiKeyScheme, IntegrationAuthentication, IntegrationError } from 'strategydance-database/backend'
import { z } from 'zod'

import type { OutboundRequest, OutboundStream, ResolvedAddress } from '~utils/requestOutbound'

import hashIntegrationToolDefinition from './hashIntegrationToolDefinition'
import IntegrationFailure from './IntegrationFailure'
import reachIntegration from './reachIntegration'

const PUBLIC = { address: '93.184.215.14', family: 4 }

const URL = 'https://mcp.example.com/mcp'

type ServerOptions = {
  // How many tools the server lists
  toolCount?: number
  // Whether it speaks only the 2026-07-28 revision, refusing a 2025 handshake
  isModernOnly?: boolean
  // What a request has to carry to be answered rather than refused with a 401
  isAuthorized?: (headers: Headers) => boolean
}

// An MCP server built by the SDK's own handler, as remote servers are, listing tools that do nothing
function createServer({ toolCount = 2, isModernOnly = false, isAuthorized = () => true }: ServerOptions = {}) {
  const handler = createMcpHandler(
    () => {
      const server = new McpServer({ name: 'checked', version: '1.0.0' }, { capabilities: { tools: {} } })

      for (let index = 0; index < toolCount; index++) {
        server.registerTool(
          index === 0 ? 'list_issues' : `tool_${index}`,
          {
            title: index === 0 ? 'List issues' : undefined,
            description: `Tool number ${index}`,
            inputSchema: z.object({ query: z.string().describe('What to look for') }),
            annotations: { readOnlyHint: index === 0 },
          },
          async () => ({ content: [] }),
        )
      }

      return server
    },
    { responseMode: 'sse', legacy: isModernOnly ? 'reject' : 'stateless' },
  )
  const received: Headers[] = []

  // The guard's transport, answering from the handler what Node's HTTP would answer from the network
  async function send(
    url: URL,
    _address: ResolvedAddress,
    headers: Record<string, string>,
    signal: AbortSignal,
    { method, body }: OutboundRequest,
  ): Promise<OutboundStream> {
    const request = new Request(url, { method, headers, body: body && new Uint8Array(body), signal })

    received.push(request.headers)

    const response = isAuthorized(request.headers)
      ? await handler.fetch(request)
      : new Response('Unauthorized', { status: 401, headers: { 'www-authenticate': 'Bearer realm="checked"' } })

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: (async function* () {
        if (!response.body) return

        for await (const chunk of response.body) yield chunk
      })(),
    }
  }

  return { send, received, resolve: async () => [PUBLIC] }
}

function reach(
  network: ReturnType<typeof createServer>,
  configuration: Partial<Parameters<typeof reachIntegration>[0]> = {},
) {
  return reachIntegration(
    { url: URL, authentication: IntegrationAuthentication.NONE, credential: null, ...configuration },
    network,
  )
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof IntegrationFailure ? error.kind : error
  }

  return null
}

describe('reachIntegration', () => {
  test("lists a server's tools, each with the hash of its definition", async () => {
    const result = await reach(createServer())

    expect(result.issuer).toBeNull()
    expect(result.toolCount).toBe(2)

    const tools = JSON.parse(result.tools!)

    expect(tools[0]).toMatchObject({
      name: 'list_issues',
      title: 'List issues',
      description: 'Tool number 0',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'What to look for' } } },
    })
    expect(tools[0].definitionHash).toBe(
      hashIntegrationToolDefinition({
        name: tools[0].name,
        description: tools[0].description,
        inputSchema: tools[0].inputSchema,
        annotations: tools[0].annotations,
      }),
    )
    expect(result.toolDefinitionHashes).toEqual(tools.map((tool: { definitionHash: string }) => tool.definitionHash))
  })

  test('sends a key as a bearer token, and in no other header', async () => {
    const network = createServer({ isAuthorized: headers => headers.get('authorization') === 'Bearer sk_secret' })

    const result = await reach(network, {
      authentication: IntegrationAuthentication.API_KEY,
      credential: { key: 'sk_secret', scheme: IntegrationApiKeyScheme.BEARER, header: null },
    })

    expect(result.toolCount).toBe(2)

    for (const headers of network.received) {
      expect(headers.get('authorization')).toBe('Bearer sk_secret')
      expect([...headers].filter(([, value]) => value.includes('sk_secret')).map(([name]) => name)).toEqual([
        'authorization',
      ])
    }
  })

  test('sends a key alone in the header it names, and no bearer token', async () => {
    const network = createServer({ isAuthorized: headers => headers.get('x-api-key') === 'sk_secret' })

    const result = await reach(network, {
      authentication: IntegrationAuthentication.API_KEY,
      credential: { key: 'sk_secret', scheme: IntegrationApiKeyScheme.HEADER, header: 'X-API-Key' },
    })

    expect(result.toolCount).toBe(2)

    for (const headers of network.received) {
      expect(headers.get('x-api-key')).toBe('sk_secret')
      expect(headers.get('authorization')).toBeNull()
    }
  })

  test('says a key was refused when the server answers 401 to it', async () => {
    const network = createServer({ isAuthorized: headers => headers.get('authorization') === 'Bearer right' })

    expect(
      await failure(
        reach(network, {
          authentication: IntegrationAuthentication.API_KEY,
          credential: { key: 'wrong', scheme: IntegrationApiKeyScheme.BEARER, header: null },
        }),
      ),
    ).toBe(IntegrationError.KEY_REFUSED)
    expect(
      await failure(
        reach(network, {
          authentication: IntegrationAuthentication.API_KEY,
          credential: { key: 'wrong', scheme: IntegrationApiKeyScheme.HEADER, header: 'X-API-Key' },
        }),
      ),
    ).toBe(IntegrationError.KEY_REFUSED)
  })

  test('says a server added without authentication asks for it', async () => {
    expect(await failure(reach(createServer({ isAuthorized: () => false })))).toBe(
      IntegrationError.AUTHENTICATION_REQUIRED,
    )
  })

  test('lists the tools of a server speaking only the 2026-07-28 revision', async () => {
    expect((await reach(createServer({ isModernOnly: true }))).toolCount).toBe(2)
  })

  test('refuses a server listing more tools than a server may', async () => {
    expect(await failure(reach(createServer({ toolCount: MAX_INTEGRATION_TOOLS + 1 })))).toBe(
      IntegrationError.TOO_MANY_TOOLS,
    )
  })

  test('refuses an address that is not public, reaching nothing', async () => {
    const network = createServer()

    expect(
      await failure(
        reachIntegration(
          { url: URL, authentication: IntegrationAuthentication.NONE, credential: null },
          {
            ...network,
            resolve: async () => [{ address: '10.0.0.7', family: 4 }],
          },
        ),
      ),
    ).toBe(IntegrationError.ADDRESS_REFUSED)
    expect(network.received).toHaveLength(0)
  })

  test('says a server that is not one answers otherwise', async () => {
    const send = async (): Promise<OutboundStream> => ({
      status: 404,
      headers: { 'content-type': 'text/html' },
      body: (async function* () {
        yield new TextEncoder().encode('<h1>Not found</h1>')
      })(),
    })

    expect(
      await failure(
        reachIntegration(
          { url: URL, authentication: IntegrationAuthentication.NONE, credential: null },
          { resolve: async () => [PUBLIC], send },
        ),
      ),
    ).toBe(IntegrationError.NOT_MCP_SERVER)
  })
})
