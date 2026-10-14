import { MAX_INTEGRATION_TOOLS } from 'strategydance-core'
import { IntegrationError } from 'strategydance-database/backend'

import connectIntegrationClient, {
  type IntegrationClientOptions,
  type IntegrationCredential,
} from '~domain/integrations/connectIntegrationClient'
import IntegrationFailure from '~domain/integrations/IntegrationFailure'

/*
  The tools an organization's MCP server lists, through a client connected as
  `connectIntegrationClient` connects it, the session ended once they are read. A server listing
  more than `MAX_INTEGRATION_TOOLS` tools is refused rather than kept in part
*/
async function listIntegrationTools(options: IntegrationClientOptions) {
  const { client, requestOptions, close } = await connectIntegrationClient(options)
  let tools

  try {
    const listed = await client.listTools(undefined, requestOptions)

    tools = listed.tools
  } finally {
    await close()
  }

  if (tools.length > MAX_INTEGRATION_TOOLS) {
    throw new IntegrationFailure(
      IntegrationError.TOO_MANY_TOOLS,
      `${new URL(options.url).origin} listed ${tools.length} tools`,
    )
  }

  return tools
}

export { type IntegrationCredential }

export default listIntegrationTools
