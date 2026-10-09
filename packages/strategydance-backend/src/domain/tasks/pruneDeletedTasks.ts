import { pruneDeletedTasks as pruneDeletedTasksMutation } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  Removes every task deleted over a day ago, past its Undo, in every organization, with its links,
  which the daily sweep does whether or not anybody deletes another. Answers how many it deleted
*/
async function pruneDeletedTasks() {
  const { data } = await pruneDeletedTasksMutation(dataConnect)

  logger.info(`Swept deleted tasks: ${data.task_deleteMany} deleted`)

  return { deleted: data.task_deleteMany }
}

export default pruneDeletedTasks
