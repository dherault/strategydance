import type { SubagentsWriteResult } from '~types'

import toSubagentsRefusal from '~modules/subagents/toSubagentsRefusal'
import toToolResult from '~modules/toToolResult'

/*
  What a write tool of the Subagents module answers: its result, the same whether the write ran now,
  was answered from its idempotency key, or changed nothing, or the refusal worded for the model
*/
function toSubagentsWriteResult<Result extends { id: string }>(written: SubagentsWriteResult<Result>) {
  // Only an answer carries a result, which no refusal does
  if (!('result' in written)) return toSubagentsRefusal(written)

  return toToolResult(written.result as Result)
}

export default toSubagentsWriteResult
