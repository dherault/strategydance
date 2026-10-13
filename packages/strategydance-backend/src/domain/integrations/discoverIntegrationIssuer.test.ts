import { describe, expect, mock, test } from 'bun:test'

import { IssuerMismatchError } from '@modelcontextprotocol/client'
import { IntegrationError } from 'strategydance-database/backend'

import discoverIntegrationIssuer from './discoverIntegrationIssuer'
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

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof IntegrationFailure ? error.kind : error
  }

  return null
}

describe('discoverIntegrationIssuer', () => {
  test('follows the metadata its 401 names to the authorization server, and keeps its issuer', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized('https://mcp.example.com/.well-known/oauth-protected-resource/mcp'),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(AUTHORIZATION_SERVER),
    })

    expect(await discoverIntegrationIssuer(URL, fetch)).toBe('https://auth.example.com')
  })

  test('reads the metadata at the root when the path holds none', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized(),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource': () =>
        json({ resource: 'https://mcp.example.com', authorization_servers: ['https://auth.example.com'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () => json(AUTHORIZATION_SERVER),
    })

    expect(await discoverIntegrationIssuer(URL, fetch)).toBe('https://auth.example.com')
  })

  test('takes the authorization server at its own origin only when no metadata exists anywhere', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized(),
      'GET https://mcp.example.com/.well-known/oauth-authorization-server': () =>
        json({ ...AUTHORIZATION_SERVER, issuer: 'https://mcp.example.com' }),
    })

    expect(await discoverIntegrationIssuer(URL, fetch)).toBe('https://mcp.example.com')
  })

  test('never takes the origin for a metadata that failed otherwise, so an outage reads as no other issuer', async () => {
    const { fetch, asked } = createNetwork({
      [`POST ${URL}`]: unauthorized(),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        new Response('Down', { status: 503 }),
      'GET https://mcp.example.com/.well-known/oauth-authorization-server': () =>
        json({ ...AUTHORIZATION_SERVER, issuer: 'https://mcp.example.com' }),
    })

    await expect(discoverIntegrationIssuer(URL, fetch)).rejects.toThrow()
    expect(asked).not.toContain('GET https://mcp.example.com/.well-known/oauth-authorization-server')
  })

  test('refuses metadata naming another resource', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized('https://mcp.example.com/.well-known/oauth-protected-resource/mcp'),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: 'https://elsewhere.example.com/mcp', authorization_servers: ['https://auth.example.com'] }),
    })

    expect(await failure(discoverIntegrationIssuer(URL, fetch))).toBe(IntegrationError.DISCOVERY_FAILED)
  })

  test('refuses an authorization server naming another issuer', async () => {
    const { fetch } = createNetwork({
      [`POST ${URL}`]: unauthorized('https://mcp.example.com/.well-known/oauth-protected-resource/mcp'),
      'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp': () =>
        json({ resource: URL, authorization_servers: ['https://auth.example.com'] }),
      'GET https://auth.example.com/.well-known/oauth-authorization-server': () =>
        json({ ...AUTHORIZATION_SERVER, issuer: 'https://attacker.example.com' }),
    })

    const error = await discoverIntegrationIssuer(URL, fetch).catch((thrown: unknown) => thrown)

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

      expect(await failure(discoverIntegrationIssuer(URL, fetch))).toBe(IntegrationError.DISCOVERY_FAILED)
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

    expect(await discoverIntegrationIssuer(URL, fetch)).toBe('https://auth.example.com')
  })

  test('says an address with nothing behind it is no MCP server', async () => {
    const { fetch } = createNetwork({})

    expect(await failure(discoverIntegrationIssuer(URL, fetch))).toBe(IntegrationError.NOT_MCP_SERVER)
  })
})
