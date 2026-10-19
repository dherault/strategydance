import { deleteExpiredRunSpends } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  Removes what runs may have cost that last spent over a day ago, whoever ran them and whatever
  became of their run, their conversation and their organization, which the daily sweep does. Only
  the last 24 hours' count against a daily spend ceiling. Answers how many it removed
*/
async function pruneRunSpends() {
  const { data } = await deleteExpiredRunSpends(dataConnect)

  logger.info(`Swept run spends: ${data.runSpend_deleteMany} deleted`)

  return { deleted: data.runSpend_deleteMany }
}

export default pruneRunSpends
