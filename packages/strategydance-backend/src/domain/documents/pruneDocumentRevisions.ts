import { deleteExpiredDocumentRevisions } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  The daily sweep's: deletes every document's revisions made over 30 days ago, so a member goes
  back a month and no further. Deleting them twice deletes nothing, so a sweep that failed is
  finished by the next
*/
async function pruneDocumentRevisions() {
  const { data } = await deleteExpiredDocumentRevisions(dataConnect)

  logger.info(`Swept document revisions: ${data.documentRevision_deleteMany} deleted`)

  return { deleted: data.documentRevision_deleteMany }
}

export default pruneDocumentRevisions
