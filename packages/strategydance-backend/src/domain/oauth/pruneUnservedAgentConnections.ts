import { SERVED_MODULE_NAMES } from 'strategydance-core'
import { pruneUnservedAgentConnections as pruneUnservedAgentConnectionsMutation } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  The daily sweep's: deletes the external agents' connections to a module no endpoint serves any
  more, renamed or retired, with their tokens, which nothing accepts. A member sees them on the
  Connected agents tab under the old module's name until then, and connects the agent again to the
  module that took its place. Deleting them twice deletes nothing, so a sweep that failed is
  finished by the next
*/
async function pruneUnservedAgentConnections() {
  const { data } = await pruneUnservedAgentConnectionsMutation(dataConnect, { modules: [...SERVED_MODULE_NAMES] })

  logger.info(`Swept agent connections to unserved modules: ${data.agentConnection_deleteMany} deleted`)

  return { deleted: data.agentConnection_deleteMany }
}

export default pruneUnservedAgentConnections
