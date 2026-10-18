import { deleteExpiredCappedStarts } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  Removes the starts the daily caps counted over a day ago, whoever made them and whatever became of
  their organization, which the daily sweep does. Only the last 24 hours' count against any cap.
  Answers how many it removed
*/
async function pruneCappedStarts() {
  const { data } = await deleteExpiredCappedStarts(dataConnect)

  logger.info(`Swept capped starts: ${data.cappedStart_deleteMany} deleted`)

  return { deleted: data.cappedStart_deleteMany }
}

export default pruneCappedStarts
