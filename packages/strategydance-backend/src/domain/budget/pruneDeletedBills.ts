import { pruneDeletedBills as pruneDeletedBillsMutation } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  Removes every bill deleted over a day ago, past its Undo, in every organization, which the daily
  sweep does whether or not anybody deletes another. Its receipt stays, held by nothing, for
  `pruneBillReceipts` to take. Answers how many it deleted
*/
async function pruneDeletedBills() {
  const { data } = await pruneDeletedBillsMutation(dataConnect)

  logger.info(`Swept deleted bills: ${data.bill_deleteMany} deleted`)

  return { deleted: data.bill_deleteMany }
}

export default pruneDeletedBills
