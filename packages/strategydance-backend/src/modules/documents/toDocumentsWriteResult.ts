import createModuleWriteResult from '~modules/createModuleWriteResult'
import toDocumentsRefusal from '~modules/documents/toDocumentsRefusal'

/*
  What a write tool of the Documents module answers: its result, the same whether the write ran now
  or was answered from its idempotency key, a document's web address added for an external caller,
  or the refusal worded for the model
*/
const toDocumentsWriteResult = createModuleWriteResult(toDocumentsRefusal)

export default toDocumentsWriteResult
