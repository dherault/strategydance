import { deleteExpiredModuleCallResults } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

/*
  The daily sweep's: deletes the module call results past their expiry, an external agent's a day
  after its call, which no retry reads any more. Deleting them twice deletes nothing, so a sweep
  that failed is finished by the next
*/
async function pruneModuleCallResults() {
  const { data } = await deleteExpiredModuleCallResults(dataConnect)

  return { deleted: data.moduleCallResult_deleteMany }
}

export default pruneModuleCallResults
