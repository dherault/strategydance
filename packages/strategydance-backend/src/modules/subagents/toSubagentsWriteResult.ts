import type { SubagentsWriteResult } from '~types'

import createModuleWriteResult from '~modules/createModuleWriteResult'
import toSubagentsRefusal from '~modules/subagents/toSubagentsRefusal'

const toWriteResult = createModuleWriteResult(toSubagentsRefusal)

/*
  What a write tool of the Subagents module answers: its result, the same whether the write ran now,
  was answered from its idempotency key, or changed nothing, or the refusal worded for the model. No
  web address, since a subagent is reached from its parent's thread
*/
function toSubagentsWriteResult<Result extends { id: string }>(written: SubagentsWriteResult<Result>) {
  return toWriteResult(written, null)
}

export default toSubagentsWriteResult
