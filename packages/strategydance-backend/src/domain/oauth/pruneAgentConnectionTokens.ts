import { pruneAgentConnectionTokens as pruneAgentConnectionTokensMutation } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  The daily sweep's: deletes the external agents' tokens past their expiry, a refresh token spent
  or not, which nothing accepts any more. Deleting them twice deletes nothing, so a sweep that
  failed is finished by the next
*/
async function pruneAgentConnectionTokens() {
  const { data } = await pruneAgentConnectionTokensMutation(dataConnect)

  logger.info(`Swept agent connection tokens: ${data.agentConnectionToken_deleteMany} deleted`)

  return { deleted: data.agentConnectionToken_deleteMany }
}

export default pruneAgentConnectionTokens
