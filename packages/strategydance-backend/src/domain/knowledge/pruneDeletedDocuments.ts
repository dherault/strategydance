import { deleteExpiredDocuments } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  The daily sweep's: deletes every organization's documents deleted over a day ago, past their
  restore, so a day means a day whether or not anybody deletes another, as a delete prunes its own
  organization's. Deleting them twice deletes nothing, so a sweep that failed is finished by the next
*/
async function pruneDeletedDocuments() {
  const { data } = await deleteExpiredDocuments(dataConnect)

  logger.info(`Swept deleted documents: ${data.document_deleteMany} deleted`)

  return { deleted: data.document_deleteMany }
}

export default pruneDeletedDocuments
