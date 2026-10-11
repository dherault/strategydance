import { pruneOAuthAuthorizationRequests as pruneOAuthAuthorizationRequestsMutation } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  The daily sweep's: deletes the authorization requests expired over a day ago, decided or not, so
  a code presented again within that day is still traced to its connection, and revokes it.
  Deleting them twice deletes nothing, so a sweep that failed is finished by the next
*/
async function pruneOAuthAuthorizationRequests() {
  const { data } = await pruneOAuthAuthorizationRequestsMutation(dataConnect)

  logger.info(`Swept OAuth authorization requests: ${data.oAuthAuthorizationRequest_deleteMany} deleted`)

  return { deleted: data.oAuthAuthorizationRequest_deleteMany }
}

export default pruneOAuthAuthorizationRequests
