import { MODULE_ADDRESSES } from 'strategydance-core'
import { pruneUnservedAgentConnections as pruneUnservedAgentConnectionsMutation } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  The daily sweep's: deletes the external agents' connections at an address no endpoint serves any
  more, renamed or retired, with their tokens, which nothing accepts, once neither made nor used for
  a week, so a worker on an older release never takes a newer address's. A connection names its
  address, `strategydance` for the one address and a module's name for its own, so those at the one
  address stay, idle or not. A member sees the others on the Connected agents tab under the old
  name until then, and connects the agent again where it is served now. Deleting them twice deletes
  nothing, so a sweep that failed is finished by the next
*/
async function pruneUnservedAgentConnections() {
  const { data } = await pruneUnservedAgentConnectionsMutation(dataConnect, {
    modules: MODULE_ADDRESSES.map(({ name }) => name),
  })

  logger.info(`Swept agent connections at unserved addresses: ${data.agentConnection_deleteMany} deleted`)

  return { deleted: data.agentConnection_deleteMany }
}

export default pruneUnservedAgentConnections
