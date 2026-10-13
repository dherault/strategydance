import { findExternalMcpServer } from 'strategydance-external-mcp-servers'

/*
  Where the mark of the external MCP server a server was added from is served, or null for a server
  added by its address, or one the app has no mark for, which draws its initial instead
*/
function getIntegrationMarkUrl(catalogueSlug: string | null | undefined) {
  const server = findExternalMcpServer(catalogueSlug)

  return server?.hasMark ? `/assets/images/mcp/${server.slug}.svg` : null
}

export default getIntegrationMarkUrl
