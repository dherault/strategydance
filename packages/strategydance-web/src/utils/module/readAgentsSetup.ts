import { MODULES_ADDRESS } from 'strategydance-core'

import { API_URL } from '~data/api'

/*
  What a member gives an agent of their own to connect it: the one address, where one connection
  reaches every module the member allows, on the backend this page talks to, the production one or
  the local one against the emulators, and the command and the configuration Claude Code and Cursor
  take, under the server's name, `strategydance`. Every module's page gives the same
*/
function readAgentsSetup() {
  const address = `${API_URL}${MODULES_ADDRESS.path}`
  const serverName = MODULES_ADDRESS.name

  return {
    address,
    claudeCode: `claude mcp add --transport http ${serverName} ${address}`,
    cursor: JSON.stringify({ mcpServers: { [serverName]: { url: address } } }, null, 2),
  }
}

export default readAgentsSetup
