import createModuleWriteResult from '~modules/createModuleWriteResult'
import toKnowledgeRefusal from '~modules/knowledge/toKnowledgeRefusal'

/*
  What a write tool of the Knowledge module answers: its result, the same whether the write ran now,
  was answered from its idempotency key, or changed nothing, or the refusal worded for the model
*/
const toKnowledgeWriteResult = createModuleWriteResult(toKnowledgeRefusal)

export default toKnowledgeWriteResult
