import type { KnowledgeWriteResult } from '~types'

import toKnowledgeRefusal from '~modules/knowledge/toKnowledgeRefusal'
import toToolResult from '~modules/toToolResult'

/*
  What a write tool of the Knowledge module answers: its result, the same whether the write ran now,
  was answered from its idempotency key, or changed nothing, or the refusal worded for the model
*/
function toKnowledgeWriteResult<Result extends { id: string }>(written: KnowledgeWriteResult<Result>) {
  // Only an answer carries a result, which no refusal does
  if (!('result' in written)) return toKnowledgeRefusal(written)

  return toToolResult(written.result as Result)
}

export default toKnowledgeWriteResult
