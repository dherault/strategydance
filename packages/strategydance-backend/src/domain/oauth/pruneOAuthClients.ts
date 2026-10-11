import { pruneOAuthClients as pruneOAuthClientsMutation } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  The daily sweep's: deletes the registrations made over a day ago that no authorization has named
  for a day and that no connection uses, which anybody can make and nobody uses. Deleting them
  twice deletes nothing, so a sweep that failed is finished by the next
*/
async function pruneOAuthClients() {
  const { data } = await pruneOAuthClientsMutation(dataConnect)

  logger.info(`Swept OAuth clients: ${data.oAuthClient_deleteMany} deleted`)

  return { deleted: data.oAuthClient_deleteMany }
}

export default pruneOAuthClients
