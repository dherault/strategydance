import type { KnowledgeWriteResult } from '~types'

import createModuleWriteResult from '~modules/createModuleWriteResult'
import toKnowledgeRefusal from '~modules/knowledge/toKnowledgeRefusal'

const toWriteResult = createModuleWriteResult(toKnowledgeRefusal)

/*
  What a write tool of the Knowledge module answers: its result, the same whether the write ran now,
  was answered from its idempotency key, or changed nothing, or the refusal worded for the model. No
  web address, since no page shows the knowledge
*/
function toKnowledgeWriteResult<Result extends { id: string }>(written: KnowledgeWriteResult<Result>) {
  return toWriteResult(written, null)
}

export default toKnowledgeWriteResult
