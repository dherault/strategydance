import externalMcpServers from './externalMcpServers.json'
import type { ExternalMcpServer } from './types'

export * from './enums'

export type * from './types'

/*
  Remote MCP servers an administrator adds to their organization in a click, each one checked to
  answer at its address as an MCP server and, for an OAuth one, to offer S256 and a way for Strategy
  Dance to register without a human, dynamic registration or client ID metadata documents. Sorted by
  name
*/
export const EXTERNAL_MCP_SERVERS = externalMcpServers as ExternalMcpServer[]

// The server of that slug, or null when none has it
export function findExternalMcpServer(slug: string | null | undefined) {
  return EXTERNAL_MCP_SERVERS.find(server => server.slug === slug) ?? null
}

/*
  The server at that address, or null when none is, read as the URL parser writes an address, so
  `https://mcp.vercel.com` and `https://mcp.vercel.com/` are one
*/
export function findExternalMcpServerByUrl(url: string) {
  const href = toHref(url)

  return href === null ? null : (EXTERNAL_MCP_SERVERS.find(server => toHref(server.url) === href) ?? null)
}

function toHref(url: string) {
  try {
    return new URL(url.trim()).href
  } catch {
    return null
  }
}
