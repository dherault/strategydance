import createModuleWriteResult from '~modules/createModuleWriteResult'
import toSubagentsRefusal from '~modules/subagents/toSubagentsRefusal'

/*
  What a write tool of the Subagents module answers: its result, the same whether the write ran now,
  was answered from its idempotency key, or changed nothing, or the refusal worded for the model
*/
const toSubagentsWriteResult = createModuleWriteResult(toSubagentsRefusal)

export default toSubagentsWriteResult
