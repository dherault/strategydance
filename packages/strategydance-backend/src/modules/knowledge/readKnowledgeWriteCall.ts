import createModuleWriteCallReader from '~modules/createModuleWriteCallReader'
import knowledgeModule from '~modules/knowledge/knowledgeModule'
import toKnowledgeRefusal from '~modules/knowledge/toKnowledgeRefusal'

// What every write tool of the Knowledge module checks before anything is read or written: the write
// scope, and the idempotency key its call carries, if any
const readKnowledgeWriteCall = createModuleWriteCallReader(knowledgeModule.scopes.write, toKnowledgeRefusal)

export default readKnowledgeWriteCall
