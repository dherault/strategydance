import type { MessageDescriptor } from 'react-intl'
import { EXTERNAL_MCP_SERVERS } from 'strategydance-external-mcp-servers'

/*
  What each external MCP server gives access to, under its name in the Integrations page's gallery:
  the English of strategydance-external-mcp-servers' list, by the server's slug, built from it rather
  than written out again, so a server added there is translated by the next `bun run translate`
*/
const externalMcpServerMessages: Record<string, MessageDescriptor> = Object.fromEntries(
  EXTERNAL_MCP_SERVERS.map(({ slug, name, description }) => [
    slug,
    {
      id: `externalMcpServer.${slug}`,
      defaultMessage: description,
      description: `What the MCP server of ${name}, an online service, gives Strategy Dance, the app's AI, access to, shown under ${name}'s name in a gallery of servers an organization adds in a click. A few words ending with a full stop; keep product names as they are.`,
    },
  ]),
)

export default externalMcpServerMessages
