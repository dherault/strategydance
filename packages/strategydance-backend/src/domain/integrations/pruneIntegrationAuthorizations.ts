import { pruneIntegrationAuthorizations as pruneIntegrationAuthorizationsMutation } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  The daily sweep's for members' Connects: deletes those that expired over an hour ago, finished or
  not, with the verifiers and codes they hold. Idempotent, so a sweep that failed is finished by the
  next
*/
async function pruneIntegrationAuthorizations() {
  const { data } = await pruneIntegrationAuthorizationsMutation(dataConnect)

  logger.info(`Swept expired integration Connects: ${data.integrationAuthorization_deleteMany} deleted`)

  return { deleted: data.integrationAuthorization_deleteMany }
}

export default pruneIntegrationAuthorizations
