import type { ExternalMcpServerApiKeyScheme, ExternalMcpServerAuthentication, ExternalMcpServerCategory } from './enums'

export type ExternalMcpServer = {
  // Lowercase letters and digits, which names the server's mark and its description's message
  slug: string
  name: string
  // The Streamable HTTP endpoint, https on its own port, as the server's own documentation gives it
  url: string
  authentication: ExternalMcpServerAuthentication
  // How a key-based server reads its key, and the header it reads it from; null for any other
  apiKeyScheme: ExternalMcpServerApiKeyScheme | null
  apiKeyHeader: string | null
  category: ExternalMcpServerCategory
  // What it gives access to, in a few words ending with a full stop, in English: the app translates it
  description: string
  // Whether the app has its mark, `/assets/images/mcp/<slug>.svg`, or draws its initial instead
  hasMark: boolean
  // The day the server was last checked to answer as an MCP server Strategy Dance can connect
  lastChecked: string
}
