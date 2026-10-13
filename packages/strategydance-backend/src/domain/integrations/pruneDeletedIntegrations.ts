import { pruneDeletedIntegrations as pruneDeletedIntegrationsMutation } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  The daily sweep's for integrations: deletes every organization's servers deleted over a day ago,
  past their Undo, with the key each holds. Idempotent, so a sweep that failed is finished by the
  next
*/
async function pruneDeletedIntegrations() {
  const { data } = await pruneDeletedIntegrationsMutation(dataConnect)

  logger.info(`Swept deleted integrations: ${data.organizationIntegration_deleteMany} deleted`)

  return { deleted: data.organizationIntegration_deleteMany }
}

export default pruneDeletedIntegrations
