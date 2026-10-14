import { describe, expect, mock, test } from 'bun:test'

import { IssuerMismatchError } from '@modelcontextprotocol/client'
import { IntegrationError } from 'strategydance-database/backend'

import discoverIntegrationAuthorizationServer from './discoverIntegrationAuthorizationServer'
import IntegrationFailure from './IntegrationFailure'

const URL = 'https://mcp.example.com/mcp'

const AUTHORIZATION_SERVER = {
  issuer: 'https://auth.example.com',
  authorization_endpoint: 'https://auth.example.com/authorize',
  token_endpoint: 'https://auth.example.com/token',
  registration_endpoint: 'https://auth.example.com/register',
  response_types_supported: ['code'],
  code_challenge_methods_supported: ['S256'],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/*
  A network answering each address from a table, by method and address, and 404 for anything else,
  keeping every address it was asked for
*/
function createNetwork(table: Record<string, () => Response>) {
  const asked: string[] = []
  const fetch = mock(async (input: string | globalThis.URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`

    asked.push(key)

    return table[key]?.() ?? new Response('Not found', { status: 404 })
  })

  return { fetch, asked }
}

function unauthorized(resourceMetadata?: string) {
  return () =>
    new Response('Unauthorized', {
      status: 401,
      headers: {
        'www-authenticate': resourceMetadata ? `Bearer resource_metadata="${resourceMetadata}"` : 'Bearer realm="mcp"',
      },
    })
}

// The issuer a discovery found, which most of these tests are about
async function discoverIssuer(url: string, fetch: Parameters<typeof discoverIntegrationAuthorizationServer>[1]) {
  return (await discoverIntegrationAuthorizationServer(url, fetch)).issuer
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof IntegrationFailure ? error.kind : error
  }

  return null
}

describe('discoverIntegrationAuthorizationServer', () => {
  test('follows the metadata its 401 names to the authorization server, and keeps its issuer', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized('https://mcp.example.com/.well-known/oauth-protected-resource/mcp'),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(AUTHORIZATION_SERVER),
    })

    expect(await discoverIssuer(URL, fetch)).toBe('https://auth.example.com')
  })

  test("keeps the authorization server's metadata, the resource its metadata names and no scope", async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized(),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(AUTHORIZATION_SERVER),
    })
    const discovered = await discoverIntegrationAuthorizationServer(URL, fetch)

    expect(discovered.metadata).toMatchObject(AUTHORIZATION_SERVER)
    expect(discovered.resource).toBe(URL)
    expect(discovered.scope).toBeUndefined()
  })

  test('asks for the scope the 401 challenged with, and for a refresh token when the server lists one', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: () =>
        new Response('Unauthorized', { status: 401, headers: { 'www-authenticate': 'Bearer scope="read write"' } }),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: URL, authorization_servers: ['https://auth.example.com'], scopes_supported: ['admin'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () =>
        json({ ...AUTHORIZATION_SERVER, scopes_supported: ['read', 'write', 'offline_access'] }),
    })

    expect((await discoverIntegrationAuthorizationServer(URL, fetch)).scope).toBe('read write offline_access')
  })

  test('asks for every scope the protected resource lists when the 401 named none', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized(),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: URL, authorization_servers: ['https://auth.example.com'], scopes_supported: ['mcp:read'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(AUTHORIZATION_SERVER),
    })

    expect((await discoverIntegrationAuthorizationServer(URL, fetch)).scope).toBe('mcp:read')
  })

  test('names the server itself as the resource when it has no protected resource metadata', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized(),
      'GET https://mcp.example.com/.well-known/oauth-authorization-server': () =>
        json({ ...AUTHORIZATION_SERVER, issuer: 'https://mcp.example.com' }),
    })

    expect((await discoverIntegrationAuthorizationServer(URL, fetch)).resource).toBe(URL)
  })

  test('reads the metadata at the root when the path holds none', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized(),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource': () =>
        json({ resource: 'https://mcp.example.com', authorization_servers: ['https://auth.example.com'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(AUTHORIZATION_SERVER),
    })

    expect(await discoverIssuer(URL, fetch)).toBe('https://auth.example.com')
  })

  test('takes the authorization server at its own origin only when no metadata exists anywhere', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized(),
      'GET https://mcp.example.com/.well-known/oauth-authorization-server': () =>
        json({ ...AUTHORIZATION_SERVER, issuer: 'https://mcp.example.com' }),
    })

    expect(await discoverIssuer(URL, fetch)).toBe('https://mcp.example.com')
  })

  test('never takes the origin for a metadata that failed otherwise, so an outage reads as no other issuer', async () => {
    const { fetch, asked } = createNetwork({
      [`POST ${URL}`]: unauthorized(),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        new Response('Down', { status: 503 }),
      'GET https://mcp.example.com/.well-known/oauth-authorization-server': () =>
        json({ ...AUTHORIZATION_SERVER, issuer: 'https://mcp.example.com' }),
    })

    await expect(discoverIssuer(URL, fetch)).rejects.toThrow()
    expect(asked).not.toContain('GET https://mcp.example.com/.well-known/oauth-authorization-server')
  })

  test('refuses metadata naming another resource', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized('https://mcp.example.com/.well-known/oauth-protected-resource/mcp'),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: 'https://elsewhere.example.com/mcp', authorization_servers: ['https://auth.example.com'] }),
    })

    expect(await failure(discoverIssuer(URL, fetch))).toBe(IntegrationError.DISCOVERY_FAILED)
  })

  test('refuses an authorization server naming another issuer', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized('https://mcp.example.com/.well-known/oauth-protected-resource/mcp'),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () =>
        json({ ...AUTHORIZATION_SERVER, issuer: 'https://attacker.example.com' }),
    })

    const error = await discoverIssuer(URL, fetch).catch((thrown: unknown) => thrown)

    expect(IssuerMismatchError.isInstance(error)).toBe(true)
  })

  test('refuses an authorization server members could never connect through', async () => {
    for (const metadata of [
      { ...AUTHORIZATION_SERVER, code_challenge_methods_supported: ['plain'] },
      { ...AUTHORIZATION_SERVER, registration_endpoint: undefined },
    ]) {
      const { fetch } = createNetwork({
        [`POST ${URL}`]: unauthorized('https://mcp.example.com/.well-known/oauth-protected-resource/mcp'),
        'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
          json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
        'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(metadata),
      })

      expect(await failure(discoverIssuer(URL, fetch))).toBe(IntegrationError.DISCOVERY_FAILED)
    }
  })

  test('takes client ID metadata documents as a way to register', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized('https://mcp.example.com/.well-known/oauth-protected-resource/mcp'),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () =>
        json({
          ...AUTHORIZATION_SERVER,
          registration_endpoint: undefined,
          client_id_metadata_document_supported: true,
        }),
    })

    expect(await discoverIssuer(URL, fetch)).toBe('https://auth.example.com')
  })

  test('takes a server answering initialize without a token, as JSON or as events', async () => {
    const answer = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { protocolVersion: '2025-06-18', capabilities: {} },
    })

    for (const respond of [
      () => json(JSON.parse(answer)),
      () => new Response(`event: message\ndata: ${answer}\n\n`, { headers: { 'content-type': 'text/event-stream' } }),
    ]) {
      const { fetch } = createNetwork({
        [`POST ${URL}`]: respond,
        'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
          json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
        'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(AUTHORIZATION_SERVER),
      })

      expect(await discoverIssuer(URL, fetch)).toBe('https://auth.example.com')
    }
  })

  test('closes a stream of events left open once it has read the answer', async () => {
    const answer = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { protocolVersion: '2025-06-18', capabilities: {} },
    })
    let isClosed = false
    const { fetch } = createNetwork({
      [`POST ${URL}`]: () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(`event: message\ndata: ${answer}\n\n`))
            },
            cancel() {
              isClosed = true
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(AUTHORIZATION_SERVER),
    })

    expect(await discoverIssuer(URL, fetch)).toBe('https://auth.example.com')
    expect(isClosed).toBe(true)
  })

  test('refuses an address that neither challenges nor answers as an MCP server, whatever metadata its host has', async () => {
    for (const respond of [
      () => new Response('<html>A page</html>', { headers: { 'content-type': 'text/html' } }),
      () => new Response('Bad request', { status: 400 }),
      () => new Response('Unauthorized', { status: 401, headers: { 'www-authenticate': 'Basic realm="api"' } }),
    ]) {
      const { fetch, asked } = createNetwork({
        [`POST ${URL}`]: respond,
        'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
          json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
        'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(AUTHORIZATION_SERVER),
      })

      expect(await failure(discoverIssuer(URL, fetch))).toBe(IntegrationError.NOT_MCP_SERVER)
      expect(asked).toHaveLength(1)
    }
  })

  test('takes a 401 without a challenge only when resource metadata names the server', async () => {
    const bare = () => new Response('Unauthorized', { status: 401 })
    const named = createNetwork({
      [`POST ${URL}`]: bare,
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(AUTHORIZATION_SERVER),
    })

    expect(await discoverIssuer(URL, named.fetch)).toBe('https://auth.example.com')

    const unnamed = createNetwork({
      [`POST ${URL}`]: bare,
      'GET https://mcp.example.com/.well-known/oauth-authorization-server': () =>
        json({ ...AUTHORIZATION_SERVER, issuer: 'https://mcp.example.com' }),
    })

    expect(await failure(discoverIssuer(URL, unnamed.fetch))).toBe(IntegrationError.DISCOVERY_FAILED)
  })

  test('says an address with nothing behind it is no MCP server', async () => {
    const { fetch } = createNetwork({})

    expect(await failure(discoverIssuer(URL, fetch))).toBe(IntegrationError.NOT_MCP_SERVER)
  })
})
