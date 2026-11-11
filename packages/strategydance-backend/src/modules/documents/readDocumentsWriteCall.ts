import createModuleWriteCallReader from '~modules/createModuleWriteCallReader'
import documentsModule from '~modules/documents/documentsModule'
import toDocumentsRefusal from '~modules/documents/toDocumentsRefusal'

// What every write tool of the Documents module checks before anything is read or written: the write
// scope, and the idempotency key its call carries, if any
const readDocumentsWriteCall = createModuleWriteCallReader(documentsModule.scopes.write, toDocumentsRefusal)

export default readDocumentsWriteCall
