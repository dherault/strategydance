import { describe, expect, it } from 'bun:test'

import {
  EXTERNAL_MCP_SERVERS,
  ExternalMcpServerApiKeyScheme,
  ExternalMcpServerAuthentication,
  ExternalMcpServerCategory,
  findExternalMcpServer,
  findExternalMcpServerByUrl,
} from './index'

describe('EXTERNAL_MCP_SERVERS', () => {
  it('holds only known authentications, key schemes and categories', () => {
    const authentications: string[] = Object.values(ExternalMcpServerAuthentication)
    const schemes: string[] = Object.values(ExternalMcpServerApiKeyScheme)
    const categories: string[] = Object.values(ExternalMcpServerCategory)

    for (const server of EXTERNAL_MCP_SERVERS) {
      expect(authentications).toContain(server.authentication)
      expect(categories).toContain(server.category)

      if (server.authentication === ExternalMcpServerAuthentication.API_KEY) {
        expect(schemes).toContain(server.apiKeyScheme ?? '')
        expect(server.apiKeyHeader === null).toBe(server.apiKeyScheme === ExternalMcpServerApiKeyScheme.BEARER)
      } else {
        expect(server.apiKeyScheme).toBeNull()
        expect(server.apiKeyHeader).toBeNull()
      }
    }
  })

  // An address Strategy Dance's outbound guard reaches: https on its own port, nothing it would refuse
  it('gives each server an https address on its own port, without credentials or a fragment', () => {
    for (const server of EXTERNAL_MCP_SERVERS) {
      const url = new URL(server.url)

      expect(url.protocol).toBe('https:')
      expect(url.port).toBe('')
      expect(url.username + url.password + url.hash).toBe('')
    }
  })

  it('keys each server on a slug of lowercase letters and digits', () => {
    for (const server of EXTERNAL_MCP_SERVERS) expect(server.slug).toMatch(/^[a-z0-9]+$/)
  })

  // Shown on its own and translated, so it reads as the others do and carries no em dash
  it('describes each server in a few words ending with a full stop', () => {
    for (const server of EXTERNAL_MCP_SERVERS) {
      expect(server.description).toMatch(/^[A-Z].*\.$/)
      expect(server.description.split(' ').length).toBeLessThanOrEqual(8)
      expect(server.description).not.toContain('—')
    }
  })

  it('says the day each server was last checked', () => {
    for (const server of EXTERNAL_MCP_SERVERS) expect(server.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // One entry per server, so the gallery offers each once and a slug finds one
  it('lists each server once', () => {
    for (const key of ['slug', 'name', 'url'] as const) {
      const values = EXTERNAL_MCP_SERVERS.map(server => server[key].toLowerCase())

      expect(new Set(values).size).toBe(values.length)
    }
  })

  it('is sorted by name', () => {
    const names = EXTERNAL_MCP_SERVERS.map(({ name }) => name)

    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })))
  })
})

describe('findExternalMcpServer', () => {
  it('finds a server by its slug, and nothing for another', () => {
    for (const server of EXTERNAL_MCP_SERVERS) expect(findExternalMcpServer(server.slug)).toBe(server)

    expect(findExternalMcpServer('nothing-of-the-kind')).toBeNull()
    expect(findExternalMcpServer(null)).toBeNull()
  })
})

describe('findExternalMcpServerByUrl', () => {
  it('finds a server by its address, however the URL parser would write it', () => {
    for (const server of EXTERNAL_MCP_SERVERS) {
      expect(findExternalMcpServerByUrl(server.url)).toBe(server)
      expect(findExternalMcpServerByUrl(` ${new URL(server.url).href} `)).toBe(server)
    }
  })

  it('finds nothing at another address, or at what is no address', () => {
    expect(findExternalMcpServerByUrl('https://mcp.example.com/mcp')).toBeNull()
    expect(findExternalMcpServerByUrl('not an address')).toBeNull()
  })
})
