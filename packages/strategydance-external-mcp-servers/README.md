# strategydance-external-mcp-servers

Remote MCP servers an organization's administrators add to Strategy Dance in a click, from the
Integrations page, in `src/externalMcpServers.json`, exported as `EXTERNAL_MCP_SERVERS`, with
`findExternalMcpServer` (by slug) and `findExternalMcpServerByUrl` (by address).

Each one was checked from the outside to answer at its address as an MCP server, a nonsense path on
the same host answering otherwise, and, for one taking OAuth, to offer S256 and a way for Strategy
Dance to register without a human: dynamic client registration or client ID metadata documents,
which members' connections need (M28). A server whose authorization server offers neither, HubSpot's
or Slack's, is left out, or added with a key when it takes one, as GitHub's takes a personal access
token. `bun run probe:integrations`, in the backend's package, checks every entry again through the
backend's own outbound guard and discovery.

Each entry holds:

- `slug`: lowercase letters and digits, naming the server's mark in the app
  (`/assets/images/mcp/<slug>.svg`) and its description's message
- `name`
- `url`: the Streamable HTTP endpoint
- `authentication`: `OAUTH`, `API_KEY` or `NONE`, the database's `IntegrationAuthentication`
- `apiKeyScheme` and `apiKeyHeader`: how a key-based server reads its key, null for any other
- `category`: an `ExternalMcpServerCategory`, by which the page groups the servers
- `description`: what it gives access to, in English, which the app's `externalMcpServer`
  catalogue translates
- `hasMark`: whether the app has its mark, a Simple Icons glyph in the brand's colour, or draws its
  initial
- `lastChecked`: the day it was last checked

Adding one: add its entry, in order of name, then its mark when Simple Icons has one, then run
`bun run translate` for its description and `bun run probe:integrations` for the check.
