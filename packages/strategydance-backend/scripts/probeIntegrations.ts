import { IntegrationAuthentication, IntegrationError } from 'strategydance-database/backend'
import { EXTERNAL_MCP_SERVERS, type ExternalMcpServer } from 'strategydance-external-mcp-servers'

import createConcurrencyLimit from '~utils/createConcurrencyLimit'

import IntegrationFailure from '~domain/integrations/IntegrationFailure'
import reachIntegration from '~domain/integrations/reachIntegration'

/*
  Checks every server of strategydance-external-mcp-servers from this machine, through the backend's
  own outbound guard and discovery, as adding it would:

    bun run probe:integrations [slug…]

  An OAuth server has to pass its discovery, an issuer offering S256 and a way to register. A server
  taking no authentication has to list its tools. A key-based one, checked without a key, has to
  answer that it wants one. Each line says what it found; the script exits non-zero naming each
  server that failed, so an entry is checked before it ships and again whenever the list is doubted.
  It reaches the servers on the internet, and writes nothing
*/
const slugs = process.argv.slice(2)
const servers = slugs.length ? EXTERNAL_MCP_SERVERS.filter(({ slug }) => slugs.includes(slug)) : EXTERNAL_MCP_SERVERS
const limit = createConcurrencyLimit(6)
const failures: string[] = []

async function probe(server: ExternalMcpServer) {
  const authentication = IntegrationAuthentication[server.authentication]

  try {
    const reach = await reachIntegration({ url: server.url, authentication, credential: null })

    // A key-based entry answering without one takes no authentication: the list says otherwise
    if (authentication === IntegrationAuthentication.API_KEY) {
      throw new Error(`answered without a key (${reach.toolCount} tools), so its authentication is NONE`)
    }

    return reach.issuer === null ? `listed ${reach.toolCount} tools` : `issuer ${reach.issuer}`
  } catch (error) {
    const isExpected =
      authentication === IntegrationAuthentication.API_KEY
      && error instanceof IntegrationFailure
      && error.kind === IntegrationError.AUTHENTICATION_REQUIRED

    if (isExpected) return 'asks for its key'

    throw error
  }
}

await Promise.all(
  servers.map(server =>
    limit(async () => {
      try {
        console.log(`ok      ${server.name}: ${await probe(server)}`)
      } catch (error) {
        failures.push(server.name)
        console.log(
          `FAILED  ${server.name}: ${error instanceof IntegrationFailure ? error.kind : (error as Error).message}`,
        )
      }
    }),
  ),
)

if (failures.length) {
  console.error(`\n${failures.length} of ${servers.length} failed: ${failures.join(', ')}`)
  process.exit(1)
}

console.log(`\nAll ${servers.length} answered as they should`)

process.exit(0)
