import createModuleWriteCallReader from '~modules/createModuleWriteCallReader'
import subagentsModule from '~modules/subagents/subagentsModule'
import toSubagentsRefusal from '~modules/subagents/toSubagentsRefusal'

// What every write tool of the Subagents module checks before anything is read or written, once the
// caller names the run calling: the write scope, and the idempotency key its call carries, if any
const readSubagentsWriteCall = createModuleWriteCallReader(subagentsModule.scopes.write, toSubagentsRefusal)

export default readSubagentsWriteCall
