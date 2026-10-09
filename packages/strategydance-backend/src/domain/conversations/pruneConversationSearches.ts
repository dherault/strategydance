import { deleteExpiredConversationSearches } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  Removes the conversation searches made over a day ago, whoever made them, which the daily sweep
  does. Only the last ten minutes' count against anybody's allowance, so the rest are kept a day
  for nothing but a look at the table. Answers how many it removed
*/
async function pruneConversationSearches() {
  const { data } = await deleteExpiredConversationSearches(dataConnect)

  logger.info(`Swept conversation searches: ${data.conversationSearch_deleteMany} deleted`)

  return { deleted: data.conversationSearch_deleteMany }
}

export default pruneConversationSearches
